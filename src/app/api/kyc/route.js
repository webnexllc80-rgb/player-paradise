import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET: Check KYC status
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    let userFilter = { _id: session.userId };
    if (ObjectId.isValid(session.userId)) {
      userFilter = { _id: new ObjectId(session.userId) };
    }

    const user = await usersCol.findOne(userFilter);
    const kycCol = db.collection('kyc');
    const application = await kycCol.findOne({ userId: session.userId });

    return NextResponse.json({
      success: true,
      kycStatus: user?.kycStatus || 'unverified',
      application: application
        ? {
            fullName: application.fullName,
            state: application.state,
            idType: application.idType,
            status: application.status,
            submittedAt: application.createdAt,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Player submits KYC application
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, dob, state, idType, idNumber } = body;

    if (!fullName || !state || !idNumber) {
      return NextResponse.json(
        { success: false, error: 'Legal full name, state, and ID number are required.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const kycCol = db.collection('kyc');
    const usersCol = db.collection('users');

    const appDoc = {
      userId: session.userId,
      username: session.username,
      email: session.email,
      fullName: fullName.trim(),
      dob: dob || '',
      state: state.trim(),
      idType: idType || "Driver's License",
      idNumber: idNumber.trim(),
      status: 'PENDING',
      createdAt: new Date(),
    };

    await kycCol.insertOne(appDoc);

    let userFilter = { _id: session.userId };
    if (ObjectId.isValid(session.userId)) {
      userFilter = { _id: new ObjectId(session.userId) };
    }
    await usersCol.updateOne(userFilter, { $set: { kycStatus: 'pending' } });

    return NextResponse.json({
      success: true,
      message: 'KYC identity submitted! Verification typically completes within 10-30 minutes.',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Staff approves/rejects KYC
export async function PATCH(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff access.' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action, reason } = body;

    const db = await getDb();
    const usersCol = db.collection('users');
    const kycCol = db.collection('kyc');

    let userFilter = { _id: userId };
    if (ObjectId.isValid(userId)) {
      userFilter = { _id: new ObjectId(userId) };
    }

    if (action === 'APPROVE') {
      await usersCol.updateOne(userFilter, { $set: { kycStatus: 'approved' } });
      await kycCol.updateOne({ userId }, { $set: { status: 'APPROVED', updatedBy: session.username } });
      return NextResponse.json({ success: true, message: 'KYC verified and approved!' });
    } else {
      await usersCol.updateOne(userFilter, { $set: { kycStatus: 'rejected' } });
      await kycCol.updateOne({ userId }, { $set: { status: 'REJECTED', reason: reason || 'Document unclear' } });
      return NextResponse.json({ success: true, message: 'KYC rejected.' });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
