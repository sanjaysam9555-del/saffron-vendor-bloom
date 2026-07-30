-- Column-level lockdown: commission / margin fields must never be readable
-- by a client account through the Data API. Staff read them only through
-- admin-verified server functions using the service role.

REVOKE SELECT ON public.projects FROM authenticated, anon;
GRANT SELECT (
  id, bride_name, groom_name, wedding_date, notes, created_by,
  created_at, updated_at, archived_at, total_installments
) ON public.projects TO authenticated;

REVOKE SELECT ON public.project_vendor_quotes FROM authenticated, anon;
GRANT SELECT (
  id, project_id, vendor_id, category, quote_text, quote_amount, currency,
  status, is_final, closed_amount, notes, created_by, created_at, updated_at
) ON public.project_vendor_quotes TO authenticated;

-- Commission tables stay fully service_role / admin-policy gated.
REVOKE ALL ON public.project_quote_commissions FROM anon;
REVOKE ALL ON public.vendor_commission_payments FROM anon;
REVOKE ALL ON public.project_payments FROM anon;