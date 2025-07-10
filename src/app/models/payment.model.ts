// VNPay Payment Models for Gender Healthcare System

export interface CartItem {
  service_id: string;
  service_name: string;
  price: number;
  quantity: number;
  duration?: number;
  image_link?: string;
  description?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface VNPayPaymentRequest {
  amount: number;
  orderInfo: string;
  patientId?: string;
  services?: CartItem[];
  orderType?: string 
}

export interface VNPayPaymentResponse {
  success: boolean;
  data?: {
    orderId: string;
    paymentUrl: string;
    amount: number;
    amountInCents: number;
    orderInfo: string;
    createDate: string;
    expireDate: string;
    expiresIn: string;
    currency: string;
  };
  error?: string;
}

export interface VNPayCallbackData {
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo: string;
  vnp_CardType: string;
  vnp_OrderInfo: string;
  vnp_PayDate: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
}

export interface PaymentTransaction {
  transaction_id?: string;
  user_id?: string;
  cart_items: CartItem[];
  total_amount: number;
  payment_method: 'vnpay';
  payment_status: 'pending' | 'completed' | 'failed' | 'cancelled';
  vnpay_transaction_id?: string;
  vnpay_response_code?: string;
  created_at?: string;
  updated_at?: string;
  order_info: string;
}

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  message: string;
  payment_details?: VNPayCallbackData;
}

// Healthcare-specific payment types
export interface HealthcarePaymentSummary {
  services: CartItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  patient_info?: {
    name: string;
    email: string;
    phone: string;
  };
}
