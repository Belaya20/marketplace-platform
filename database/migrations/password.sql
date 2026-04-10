ALTER ROLE ecom_api PASSWORD 'A9f!Q7r$L2x@{3Q#T8p%
';

-- Verify the role exists
SELECT rolname, rolcanlogin FROM pg_roles
WHERE rolname IN ('ecom_api','ecom_admin','ecom_seller','ecom_customer');