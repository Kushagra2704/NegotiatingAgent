import Razorpay from "razorpay";
import crypto from "crypto";

let _instance: Razorpay | null = null;

export function getRazorpay() {
  if (!_instance) {
    _instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _instance;
}

export function verifyPaymentSignature(params: {
  order_id: string;
  payment_id: string;
  signature: string;
}): boolean {
  const body = `${params.order_id}|${params.payment_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  return expected === params.signature;
}
