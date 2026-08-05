import { NextResponse } from "next/server";
import { createCustomerInquiry } from "@/lib/customerInquiry";

export async function POST(req) {
  let body;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Unable to send your message. Please try again." },
      { status: 400 },
    );
  }

  try {
    const result = await createCustomerInquiry({
      agent_id: body?.agent_id,
      property_id: body?.property_id,
      name: body?.name || body?.full_name,
      email: body?.email,
      phone: body?.phone,
      message: body?.message,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 },
      );
    }

    return NextResponse.json({ success: true, id: result.inquiryId });
  } catch (err) {
    console.error("Customer inquiry failed:", err);
    return NextResponse.json(
      { error: "Unable to send your message. Please try again." },
      { status: 500 },
    );
  }
}
