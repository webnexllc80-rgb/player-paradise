import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET chat messages
export async function GET(req) {
  try {
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get('email') || session?.email;

    if (!userEmail) {
      return NextResponse.json({ success: true, messages: [] });
    }

    const db = await getDb();
    const chatCol = db.collection('chat');

    const messages = await chatCol
      .find({
        $or: [
          { senderEmail: userEmail.toLowerCase() },
          { receiverEmail: userEmail.toLowerCase() },
          { channel: 'support' },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(60)
      .toArray();

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m._id ? m._id.toString() : m.id,
        sender: m.sender || 'Staff Agent',
        senderEmail: m.senderEmail,
        isStaff: !!m.isStaff,
        text: m.text,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST new chat message
export async function POST(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json();
    const { text, receiverEmail } = body;

    if (!text?.trim()) {
      return NextResponse.json({ success: false, error: 'Message cannot be empty.' }, { status: 400 });
    }

    const db = await getDb();
    const chatCol = db.collection('chat');

    const isStaff = session && session.role && session.role !== ROLES.PLAYER;
    const sender = session?.username || 'Guest Player';
    const senderEmail = session?.email || 'guest@playersparadisehub.com';

    const newMsg = {
      sender,
      senderEmail: senderEmail.toLowerCase(),
      receiverEmail: (receiverEmail || 'support@playersparadisehub.com').toLowerCase(),
      isStaff,
      text: text.trim(),
      channel: 'support',
      createdAt: new Date(),
    };

    await chatCol.insertOne(newMsg);

    // If player sends a message, generate an instant helpful AI / Staff bot reply if no staff online
    if (!isStaff) {
      const lower = text.toLowerCase();
      let botReply = "Hello! Our 24/7 VIP desk is reviewing your inquiry. We're usually active within 1-2 minutes.";

      if (lower.includes('deposit') || lower.includes('cash app') || lower.includes('pay')) {
        botReply = "To deposit: Click 'Deposit' on the top navbar or wallet, pick your preferred gateway (Cash App, Zelle, Chime, Crypto), and send with your username. Our team credits deposits within 3-5 minutes!";
      } else if (lower.includes('withdraw') || lower.includes('cashout') || lower.includes('redeem')) {
        botReply = "For cashouts: Minimum withdrawal is $25 SC. Open your Wallet, select 'Cashout', enter your Cashtag/handle, and submit. Payments are processed swiftly!";
      } else if (lower.includes('game') || lower.includes('id') || lower.includes('password') || lower.includes('login')) {
        botReply = "To get game credentials for Ultra Panda, Fire Kirin, Orion Stars, or Game Vault: Go to 'Game IDs' in your sidebar or click 'Request ID' on any game card. Staff will send your username and password directly to your account!";
      } else if (lower.includes('bonus') || lower.includes('free')) {
        botReply = "Be sure to claim your Daily Mystery Box from the gift icon in the top header every 24 hours for free SC and GC credits!";
      }

      await chatCol.insertOne({
        sender: 'Paradise Support Bot',
        senderEmail: 'support@playersparadisehub.com',
        receiverEmail: senderEmail.toLowerCase(),
        isStaff: true,
        text: botReply,
        channel: 'support',
        createdAt: new Date(Date.now() + 500),
      });
    }

    return NextResponse.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
