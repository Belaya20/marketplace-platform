 
import type { Metadata } from 'next';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = { title: 'Contact — AddisMarket' };
export const revalidate = 60;

async function getCmsContent(slug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/cms/pages/${slug}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data?.content_html as string) || null;
  } catch {
    return null;
  }
}

const CONTACT_DETAILS = [
  {
    icon: Mail,
    label: 'Email',
    value: 'support@addismarket.et',
    href:  'mailto:support@addismarket.et',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '+251 911 000 000',
    href:  'tel:+251911000000',
  },
  {
    icon: MapPin,
    label: 'Address',
    value: 'Bole Road, Addis Ababa, Ethiopia',
    href:  null,
  },
  {
    icon: Clock,
    label: 'Hours',
    value: 'Mon–Fri, 9am–6pm EAT',
    href:  null,
  },
];

export default async function ContactPage() {
  const cmsContent = await getCmsContent('contact');

  return (
    <div className="container-page py-12 max-w-4xl">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Contact us</h1>
      <p className="text-gray-500 mb-10">We&apos;re here to help. Reach out to us any time.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* Left: contact info (CMS or default) */}
        <div>
          {cmsContent ? (
            <div
              className="prose prose-sm prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: cmsContent }}
            />
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Get in touch</h2>
              <div className="space-y-4">
                {CONTACT_DETAILS.map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={17} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {label}
                      </p>
                      {href ? (
                        <a href={href} className="text-sm text-violet-600 hover:text-violet-800">
                          {value}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-700">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-violet-50 rounded-xl">
                <p className="text-sm font-medium text-violet-900 mb-1">Seller support</p>
                <p className="text-xs text-violet-700">
                  For seller-specific inquiries:{' '}
                  <a
                    href="mailto:sellers@addismarket.et"
                    className="font-medium underline"
                  >
                    sellers@addismarket.et
                  </a>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right: contact form (client component) */}
        <ContactForm />
      </div>
    </div>
  );
}