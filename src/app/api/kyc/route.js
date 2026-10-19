import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES, getUserFilter, safeIdFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';

// GET: List KYC submissions (Staff) or current status (Player)
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const kycCol = db.collection('kyc_requests');
    const isStaff =
      session.role === ROLES.SUPER_ADMIN ||
      session.role === ROLES.FINANCIAL_MANAGER ||
      session.role === ROLES.OPERATION_ADMIN;

    if (!isStaff) {
      const kyc = await kycCol.findOne({ userId: session.userId }, { sort: { createdAt: -1 } });
      return NextResponse.json({ success: true, kyc });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    const query = status === 'all' ? {} : { status };
    const requests = await kycCol.find(query).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      requests: requests.map(r => ({
        id: r._id.toString(),
        userId: r.userId,
        username: r.username,
        legalName: r.legalName,
        dob: r.dob,
        state: r.state,
        ssnLast4: r.ssnLast4,
        idFrontUrl: r.idFrontUrl,
        idBackUrl: r.idBackUrl,
        selfieUrl: r.selfieUrl,
        addressProofUrl: r.addressProofUrl,
        status: r.status,
        rejectReason: r.rejectReason || null,
        processedBy: r.processedBy || null,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Player Submit KYC
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { legalName, dob, state, ssnLast4, idFrontUrl, idBackUrl, selfieUrl, addressProofUrl } = await req.json();

    if (!legalName || !dob || !state || !idFrontUrl) {
      return NextResponse.json({ success: false, error: 'Legal name, DOB, state, and ID image are required.' }, { status: 400 });
    }

    const db = await getDb();
    const kycCol = db.collection('kyc_requests');
    const usersCol = db.collection('users');

    const newKyc = {
      userId: session.userId,
      username: session.username,
      legalName,
      dob,
      state: state.toUpperCase(),
      ssnLast4: ssnLast4 || 'XXXX',
      idFrontUrl,
      idBackUrl: idBackUrl || null,
      selfieUrl: selfieUrl || null,
      addressProofUrl: addressProofUrl || null,
      status: 'pending',
      rejectReason: null,
      processedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await kycCol.insertOne(newKyc);

    await usersCol.updateOne(
      getUserFilter(session),
      { $set: { kycStatus: 'pending' } }
    );

    return NextResponse.json({
      success: true,
      id: res.insertedId.toString(),
      message: 'KYC documents submitted for compliance review.',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Review KYC (Super Admin & Financial Manager)
export async function PUT(req) {
  try {
    const authorizedRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.FINANCIAL_MANAGER,
      ROLES.OPERATION_ADMIN,
    ];
    if (!session || !authorizedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
    }

    const { kycId, action, rejectReason } = await req.json();

    if (!kycId || !action) {
      return NextResponse.json({ success: false, error: 'KYC ID and action required.' }, { status: 400 });
    }

    const db = await getDb();
    const kycCol = db.collection('kyc_requests');
    const usersCol = db.collection('users');

    const kyc = await kycCol.findOne(safeIdFilter(kycId));
    if (!kyc) {
      return NextResponse.json({ success: false, error: 'KYC request not found.' }, { status: 404 });
    }

    const user = await usersCol.findOne(safeIdFilter(kyc.userId));

    if (action === 'approve') {
      await kycCol.updateOne(
        safeIdFilter(kyc._id),
        {
          $set: {
            status: 'approved',
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      await usersCol.updateOne(
        safeIdFilter(kyc.userId),
        { $set: { kycStatus: 'approved' } }
      );

      if (user?.email) {
        sendEmail({
          to: user.email,
          subject: 'Players Paradise - KYC Verified!',
          html: `<p>Hi ${user.username}, your US identity verification has been approved! You can now request instant cash prize redemptions.</p>`,
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, message: 'KYC Approved successfully.' });
    } else if (action === 'reject') {
      await kycCol.updateOne(
        safeIdFilter(kyc._id),
        {
          $set: {
            status: 'rejected',
            rejectReason: rejectReason || 'Document blurred or information mismatch',
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      await usersCol.updateOne(
        safeIdFilter(kyc.userId),
        { $set: { kycStatus: 'rejected' } }
      );

      return NextResponse.json({ success: true, message: 'KYC Rejected.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
