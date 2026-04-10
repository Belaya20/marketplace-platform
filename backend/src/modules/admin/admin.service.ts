// src/modules/admin/admin.service.ts — Production-ready, all methods complete
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { AppError } from '../../utils/response';
import { notificationService } from '../notifications/notification.service';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

function toCount(r: any): number {
  if (!r) return 0;
  return Number(r.total ?? r.count ?? 0);
}

export const adminService = {

  async getDashboard() {
    const [
  countUsers, countSellers, countProducts, countOrders,
  sumRevenue, countPendingSellers, countPendingProducts,
  countPendingWithdrawals, recentOrders, topProducts, revenueChart,
] = await Promise.all([
  db('users').count('id as total').first(),
  db('seller_profiles').where('status','approved').count('id as total').first(),
  db('products').where('status','active').count('id as total').first(),
  db('orders').count('id as total').first(),
 
  // ← CHANGED: was .where('payment_status','paid')
  db('orders')
    .whereIn('status', ['confirmed', 'processing', 'shipped', 'delivered'])
    .sum('total as total')
    .first(),
 
  db('seller_profiles').where('status','pending').count('id as total').first(),
  db('products').where('status','pending_review').count('id as total').first(),
  db('withdrawal_requests').where('status','pending').count('id as total').first(),
  db('orders as o').join('users as u','u.id','o.customer_id')
    .orderBy('o.placed_at','desc').limit(10)
    .select('o.id','o.order_number','o.total','o.status','o.payment_status',
            'o.placed_at','u.email','u.first_name','u.last_name'),
  db('products').where('status','active').orderBy('total_sold','desc').limit(5)
    .select('id','name','slug','total_sold','avg_rating'),
  db('orders').whereIn('status', ['confirmed', 'processing', 'shipped', 'delivered'])
    .where('placed_at','>=',db.raw(`NOW() - INTERVAL '30 days'`))
    .groupByRaw(`DATE(placed_at)`)
    .select(db.raw(`DATE(placed_at) as date`),db.raw(`COUNT(*) as orders`),db.raw(`SUM(total) as revenue`))
    .orderBy('date'),
]);
 
    return {
      stats: {
        total_users:          toCount(countUsers),
        total_sellers:        toCount(countSellers),
        total_products:       toCount(countProducts),
        total_orders:         toCount(countOrders),
        total_revenue:        Number((sumRevenue as any)?.total || 0),
        pending_sellers:      toCount(countPendingSellers),
        pending_products:     toCount(countPendingProducts),
        pending_withdrawals:  toCount(countPendingWithdrawals),
      },
      recent_orders: recentOrders,
      top_products:  topProducts,
      revenue_chart: revenueChart,
    };
  },

  async getUsers(filters: any, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const applyFilters = (q: any) => {
      if (filters.role)      q = q.where('role', filters.role);
      if (filters.q)         q = q.where((b: any) => b.whereILike('email',`%${filters.q}%`).orWhereILike('first_name',`%${filters.q}%`).orWhereILike('last_name',`%${filters.q}%`));
      if (filters.suspended !== undefined) q = q.where('is_suspended', filters.suspended === 'true');
      return q;
    };
    const [countResult, users] = await Promise.all([
      applyFilters(db('users')).count('id as total').first(),
      applyFilters(db('users').select('id','email','phone','role','first_name','last_name','email_verified','is_active','is_suspended','suspension_reason','last_login_at','created_at'))
        .orderBy('created_at','desc').limit(limit).offset(offset),
    ]);
    return { users, total: toCount(countResult) };
  },

  async toggleUserStatus(userId: string, suspend: boolean, reason?: string) {
    const user = await db('users').where('id', userId).first();
    if (!user) throw AppError.notFound('User not found');
    if (user.role === 'admin') throw AppError.forbidden('Cannot suspend an admin account');
    await db('users').where('id', userId).update({
      is_suspended:      suspend,
      suspension_reason: suspend ? (reason || null) : null,
    });
    await notificationService.createInApp({
      user_id: userId, type: 'account_status',
      title: suspend ? 'Account suspended' : 'Account reactivated',
      body:  suspend ? `Your account has been suspended.${reason ? ' Reason: '+reason : ''}` : 'Your account has been reactivated.',
    }).catch(() => {});
    return { suspended: suspend, user_id: userId };
  },

  async getAllSellers(filters: any, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const applyFilters = (q: any) => {
      if (filters.status) q = q.where('sp.status', filters.status);
      if (filters.q)      q = q.where((b: any) => b.whereILike('sp.business_name',`%${filters.q}%`).orWhereILike('u.email',`%${filters.q}%`));
      return q;
    };
    const base = () => db('seller_profiles as sp').join('users as u','u.id','sp.user_id');
    const [countResult, sellers] = await Promise.all([
      applyFilters(base()).count('sp.id as total').first(),
      applyFilters(base().select('sp.id','sp.business_name','sp.status','sp.commission_rate','sp.wallet_balance','sp.total_earned','sp.created_at','sp.store_slug','sp.rejection_reason','u.email','u.first_name','u.last_name','u.phone','u.is_suspended'))
        .orderBy('sp.created_at','desc').limit(limit).offset(offset),
    ]);
    return { sellers, total: toCount(countResult) };
  },

  async approveSeller(sellerId: string, adminId: string, approve: boolean, reason?: string) {
    const seller = await db('seller_profiles').where('id', sellerId).first();
    if (!seller) throw AppError.notFound('Seller not found');
    await db('seller_profiles').where('id', sellerId).update({
      status:           approve ? 'approved' : 'rejected',
      rejection_reason: approve ? null : (reason || 'Application did not meet requirements'),
      approved_by:      approve ? adminId : null,
      approved_at:      approve ? new Date() : null,
    });
    if (approve) await db('users').where('id', seller.user_id).update({ role: 'seller' });
    await notificationService.notifySellerApproval(sellerId, approve, reason);
    return { approved: approve, seller_id: sellerId };
  },

  async updateSellerCommission(sellerId: string, rate: number) {
    if (rate < 0 || rate > 100) throw AppError.badRequest('Rate must be 0–100');
    const [sp] = await db('seller_profiles').where('id', sellerId)
      .update({ commission_rate: rate }).returning(['id','business_name','commission_rate']);
    if (!sp) throw AppError.notFound('Seller not found');
    return sp;
  },

  async updateOrderStatus(orderId: string, newStatus: string) {
    const allowed = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];
    if (!allowed.includes(newStatus)) throw AppError.badRequest(`Invalid status: ${newStatus}`);
    const order = await db('orders').where('id', orderId).first();
    if (!order) throw AppError.notFound('Order not found');
    const updates: any = { status: newStatus };
    if (newStatus === 'delivered') updates.delivered_at = new Date();
    if (newStatus === 'cancelled') updates.cancelled_at = new Date();
    await db('orders').where('id', orderId).update(updates);
    await notificationService.notifyOrderStatusChange(orderId, newStatus).catch(() => {});
    return { order_id: orderId, status: newStatus };
  },

  async getPaymentLogs(filters: any, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query      = db('payments as p').join('orders as o','o.id','p.order_id').join('users as u','u.id','o.customer_id').select('p.*','o.order_number','o.total as order_total','u.email','u.first_name','u.last_name');
    let countQuery = db('payments');
    if (filters.status) { query = query.where('p.status', filters.status); countQuery = countQuery.where('status', filters.status); }
    if (filters.date_from) query = query.where('p.initiated_at','>=', filters.date_from);
    if (filters.date_to)   query = query.where('p.initiated_at','<=', filters.date_to);
    const [countResult, payments] = await Promise.all([
      countQuery.count('id as total').first(),
      query.orderBy('p.initiated_at','desc').limit(limit).offset(offset),
    ]);
    return { payments, total: toCount(countResult) };
  },
// =============================================================================
// REPLACE these two methods in src/modules/admin/admin.service.ts
// =============================================================================

  // ── getWithdrawals — fix orderBy to use 'requested_at' ──────────────────
  async getWithdrawals(filters: any, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query = db('withdrawal_requests as wr')
      .join('seller_profiles as sp', 'sp.id', 'wr.seller_id')
      .join('users as u', 'u.id', 'sp.user_id')
      .select('wr.*', 'sp.business_name', 'u.email', 'u.first_name', 'u.last_name');
    let countQuery = db('withdrawal_requests');

    if (filters.status) {
      query      = query.where('wr.status', filters.status);
      countQuery = countQuery.where('status', filters.status);
    }

    const [countResult, withdrawals] = await Promise.all([
      countQuery.count('id as total').first(),
      // withdrawal_requests uses 'requested_at' NOT 'created_at'
      query.orderBy('wr.requested_at', 'desc').limit(limit).offset(offset),
    ]);

    return { withdrawals, total: toCount(countResult) };
  },

  // ── processWithdrawal — exact wallet_transactions columns ────────────────
 // ── processWithdrawal — REPLACE in src/modules/admin/admin.service.ts ──────
  async processWithdrawal(id: string, adminId: string, status: string, note?: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw AppError.badRequest('Status must be approved or rejected');
    }

    const wr = await db('withdrawal_requests').where('id', id).first();
    if (!wr)                     throw AppError.notFound('Withdrawal request not found');
    if (wr.status !== 'pending') throw AppError.badRequest('Only pending withdrawals can be processed');

    const amount = Number(wr.amount);

    await db.transaction(async (trx) => {
      // 1. Update the withdrawal request status
      await trx('withdrawal_requests').where('id', id).update({
        status,
        admin_note:   note || null,
        processed_by: adminId,
        processed_at: new Date(),
      });

      if (status === 'approved') {
        // Money was already moved from wallet_balance → pending_balance on request.
        // Now clear it from pending_balance — transfer has been sent to bank.
        await trx('seller_profiles').where('id', wr.seller_id).update({
          pending_balance: db.raw('GREATEST(0, pending_balance - ?)', [amount]),
        });

        // FIX: net_amount must be >= 0 (check constraint: wallet_tx_net_non_neg)
        // Direction is encoded by type = 'withdrawal_debit', NOT by a negative sign.
        await trx('wallet_transactions').insert({
          id:                uuidv4(),
          seller_id:         wr.seller_id,
          order_item_id:     null,
          type:              'withdrawal_debit',
          gross_amount:      amount,
          commission_amount: 0,
          net_amount:        amount,  // ← POSITIVE (was -amount, violated constraint)
          status:            'completed',
          reference:         id,
          note:              `Withdrawal to ${wr.bank_name} ••••${String(wr.account_number).slice(-4)}`,
        });

      } else {
        // Rejected — return money from pending_balance back to wallet_balance
        await trx('seller_profiles').where('id', wr.seller_id).update({
          wallet_balance:  db.raw('wallet_balance + ?',               [amount]),
          pending_balance: db.raw('GREATEST(0, pending_balance - ?)', [amount]),
        });

        // net_amount is positive here — type = 'refund_debit' encodes the meaning
        await trx('wallet_transactions').insert({
          id:                uuidv4(),
          seller_id:         wr.seller_id,
          order_item_id:     null,
          type:              'refund_debit',
          gross_amount:      amount,
          commission_amount: 0,
          net_amount:        amount,  // positive — funds returned to wallet
          status:            'completed',
          reference:         id,
          note:              `Withdrawal rejected — funds returned${note ? ': ' + note : ''}`,
        });
      }
    });

    // Notify seller
    const sp = await db('seller_profiles as sp')
      .join('users as u', 'u.id', 'sp.user_id')
      .where('sp.id', wr.seller_id)
      .select('u.id as user_id')
      .first();

    if (sp) {
      await notificationService.createInApp({
        user_id:    sp.user_id,
        type:       'payment',
        title:      status === 'approved'
          ? `Withdrawal of ETB ${amount.toFixed(2)} approved`
          : `Withdrawal of ETB ${amount.toFixed(2)} rejected`,
        body:       status === 'approved'
          ? `Your withdrawal to ${wr.bank_name} has been approved and processed.`
          : `Your withdrawal was rejected.${note ? ' Reason: ' + note : ' Contact support for details.'}`,
        action_url: '/seller/wallet',
      }).catch(() => {});
    }

    return { id, status };
  },

  async getFlashSales() {
    const sales = await db('flash_sales').orderBy('created_at','desc');
    for (const s of sales) {
      s.items = await db('flash_sale_items as fsi')
        .join('product_variants as pv','pv.id','fsi.variant_id')
        .join('products as p','p.id','pv.product_id')
        .where('fsi.flash_sale_id', s.id)
        .select('fsi.*','p.name','p.slug','pv.sku','pv.price');
    }
    return sales;
  },

 // ── getSalesReport — REPLACE in src/modules/admin/admin.service.ts ─────────
  // ROOT FIX: was filtering WHERE payment_status = 'paid'
  // All COD orders have payment_status = 'unpaid' → zero rows → empty charts.
  // Fix: use o.status IN ('confirmed','processing','shipped','delivered')
  // This is consistent with getDashboard() total_revenue calculation.
  async getSalesReport(filters: { date_from?: string; date_to?: string; period?: string }) {
    const period   = (filters.period as string) || 'monthly';
    const dateFrom = filters.date_from || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const dateTo   = filters.date_to   || new Date().toISOString().slice(0, 10);

    const groupBy = {
      daily:   `DATE(placed_at)`,
      monthly: `TO_CHAR(placed_at,'YYYY-MM')`,
      yearly:  `TO_CHAR(placed_at,'YYYY')`,
    }[period] ?? `DATE(placed_at)`;

    return db('orders')
      // FIX: was .where('payment_status', 'paid') — excluded ALL COD orders
      .whereIn('status', ['confirmed', 'processing', 'shipped', 'delivered'])
      .whereBetween('placed_at', [dateFrom, dateTo])
      .groupByRaw(groupBy)
      .select(
        db.raw(`${groupBy} as period`),
        db.raw('COUNT(*) as order_count'),
        db.raw('SUM(total) as revenue'),
        db.raw('AVG(total) as avg_order_value'),
      )
      .orderByRaw(groupBy);
  },
  async getSellerReport(filters: any) {
    return db('seller_profiles as sp').join('users as u','u.id','sp.user_id')
      .leftJoin('order_items as oi','oi.seller_id','sp.id')
      .leftJoin('orders as o',(b:any)=>{b.on('o.id','oi.order_id').andOnVal('o.payment_status','=','paid');})
      .where('sp.status','approved').groupBy('sp.id','u.id')
      .select('sp.id','sp.business_name','sp.commission_rate','sp.wallet_balance','sp.total_earned','u.email',
        db.raw('COUNT(DISTINCT oi.id) as total_items_sold'),
        db.raw('COALESCE(SUM(oi.line_total),0) as total_revenue'),
        db.raw('COALESCE(SUM(oi.commission_amount),0) as total_commission'))
      .orderBy('total_revenue','desc');
  },

  async exportSalesReportExcel(filters: any): Promise<Buffer> {
    const data = await this.getSalesReport(filters);
    const wb   = new ExcelJS.Workbook();
    const ws   = wb.addWorksheet('Sales Report');
    ws.columns = [
      { header:'Period',         key:'period',          width:20 },
      { header:'Orders',         key:'order_count',     width:15 },
      { header:'Revenue (ETB)',  key:'revenue',         width:20 },
      { header:'Avg Order(ETB)', key:'avg_order_value', width:20 },
    ];
    ws.getRow(1).font = { bold:true, color:{ argb:'FFFFFFFF' } };
    ws.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF4F46E5' } };
    for (const r of data) ws.addRow({ period:r.period, order_count:Number(r.order_count), revenue:Number(r.revenue).toFixed(2), avg_order_value:Number(r.avg_order_value).toFixed(2) });
    const tot = data.reduce((s:any,r:any)=>s+Number(r.revenue),0);
    const tr  = ws.addRow({ period:'TOTAL', order_count:data.reduce((s:any,r:any)=>s+Number(r.order_count),0), revenue:tot.toFixed(2) });
    tr.font = { bold:true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  },

  async exportSalesReportPDF(filters: any): Promise<Buffer> {
    const data = await this.getSalesReport(filters);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin:50 }); const chunks: Buffer[] = [];
      doc.on('data',(c)=>chunks.push(c)); doc.on('end',()=>resolve(Buffer.concat(chunks))); doc.on('error',reject);
      doc.fontSize(20).font('Helvetica-Bold').text('Sales Report',{align:'center'});
      doc.fontSize(11).font('Helvetica').text(`${filters.date_from||'All time'} to ${filters.date_to||'Now'}`,{align:'center'}).moveDown(2);
      const y0=doc.y;
      doc.fontSize(10).font('Helvetica-Bold').text('Period',50,y0).text('Orders',200,y0).text('Revenue(ETB)',290,y0).text('Avg(ETB)',420,y0);
      doc.moveTo(50,doc.y+4).lineTo(550,doc.y+4).stroke().moveDown(0.5);
      doc.font('Helvetica');
      for (const r of data) { const y=doc.y; doc.text(String(r.period),50,y).text(String(r.order_count),200,y).text(Number(r.revenue).toFixed(2),290,y).text(Number(r.avg_order_value).toFixed(2),420,y).moveDown(0.4); }
      const tot=data.reduce((s:any,r:any)=>s+Number(r.revenue),0);
      doc.moveTo(50,doc.y).lineTo(550,doc.y).stroke().moveDown(0.5);
      doc.font('Helvetica-Bold').text(`Total Revenue: ETB ${tot.toFixed(2)}`,{align:'right'});
      doc.end();
    });
  },

  async getDiscountRules(page=1, limit=20) {
    const offset=(page-1)*limit;
    const [c,rules]=await Promise.all([db('discount_rules').count('id as total').first(),db('discount_rules').orderBy('created_at','desc').limit(limit).offset(offset)]);
    return { rules, total:toCount(c) };
  },

  async createDiscountRule(data: any) {
    const [rule]=await db('discount_rules').insert({id:uuidv4(),code:data.code.toUpperCase().trim(),type:data.type,value:data.value,min_order_amount:data.min_order_amount||0,max_discount_cap:data.max_discount_cap||null,max_uses:data.max_uses||null,starts_at:data.starts_at||null,ends_at:data.ends_at||null,is_active:true}).returning('*');
    return rule;
  },

  async toggleDiscountRule(id: string, active: boolean) {
    const [r]=await db('discount_rules').where('id',id).update({is_active:active}).returning('*');
    if (!r) throw AppError.notFound('Discount rule not found');
    return r;
  },
};
