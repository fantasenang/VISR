# VISR admin order lifecycle

Pending-payment orders reserve inventory until their payment deadline.

- Expired reservations are released automatically by the hourly production cron.
- Loading VISR Control also releases any overdue reservations before dashboard data is shown.
- An authenticated owner can cancel a pending order immediately from VISR Control.
- Cancelled orders are archived as `expired`; transaction history is retained and reserved stock is returned.
- Paid or otherwise non-pending orders cannot be cancelled through the pending-order action.
