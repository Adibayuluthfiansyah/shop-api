export interface MidtransNotification {
  transaction_time: string;
  transaction_status:
    | 'capture'
    | 'settlement'
    | 'pending'
    | 'deny'
    | 'cancel'
    | 'expire'
    | 'failure';
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  fraud_status?: 'accept' | 'challenge' | 'deny';
  currency: string;
}

export interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
}
