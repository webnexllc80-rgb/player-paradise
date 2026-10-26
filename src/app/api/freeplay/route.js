import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';
import { notifyStaff } from '@/lib/notify';

// GET - Check Freeplay eligibility, configured amount, and task status
export async function GET(req) {
  try {
    const db = await getDb();
    const settingsDoc = await db.collection('system_settings').findOne({ key: 'general' });
    const configuredAmount = settingsDoc?.freeplayAmountSC !== undefined 
      ? Number(settingsDoc.freeplayAmountSC) 
      : 3.0;
    const freeplayActive = settingsDoc?.freeplayActive !== false;

    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({
        success: true,
        claimed: false,
        amount: configuredAmount,
        freeplayActive,
        pending: false,
      });
    }

    const userId = session.userId || session.id;
    let user = null;
    if (userId && ObjectId.isValid(userId)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    if (!user && session.email) {
      user = await db.collection('users').findOne({ email: session.email.toLowerCase().trim() });
    }

    const claimed = Boolean(user?.freeplayClaimed);

    // Check if there is an active pending freeplay task
    const pendingTask = await db.collection('freeplay_tasks').findOne({
      $or: [
        { userId: user?._id ? user._id.toString() : '' },
        { email: user?.email ? user.email.toLowerCase().trim() : '' },
      ],
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      claimed,
      amount: configuredAmount,
      freeplayActive,
      pending: Boolean(pendingTask),
      pendingTask: pendingTask ? {
        taskId: pendingTask.taskId,
        gameTitle: pendingTask.gameTitle,
        createdAt: pendingTask.createdAt,
      } : null,
      claimedAt: user?.freeplayClaimedAt || null,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST - Submit Freeplay Verification Task
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Please sign in to complete your Freeplay verification task.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { gameTitle, taskId, screenshot } = body;

    const db = await getDb();
    const settingsDoc = await db.collection('system_settings').findOne({ key: 'general' });
    if (settingsDoc?.freeplayActive === false) {
      return NextResponse.json(
        { success: false, message: 'Freeplay bonus is currently disabled or inactive.' },
        { status: 400 }
      );
    }
    const configuredAmount = settingsDoc?.freeplayAmountSC !== undefined 
      ? Number(settingsDoc.freeplayAmountSC) 
      : 3.0;

    const usersCol = db.collection('users');
    const userId = session.userId || session.id;
    let user = null;
    if (userId && ObjectId.isValid(userId)) {
      user = await usersCol.findOne({ _id: new ObjectId(userId) });
    }
    if (!user && session.email) {
      user = await usersCol.findOne({ email: session.email.toLowerCase().trim() });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found. Please log in again.' },
        { status: 404 }
      );
    }

    if (user.freeplayClaimed) {
      return NextResponse.json({
        success: false,
        alreadyClaimed: true,
        message: 'You have already claimed your Freeplay bonus! Make a deposit to receive extra reload bonuses.',
      });
    }

    // Require game selection and screenshot proof
    if (!gameTitle || !String(gameTitle).trim()) {
      return NextResponse.json(
        { success: false, message: 'Please select a casino game for your freeplay credits.' },
        { status: 400 }
      );
    }

    if (!screenshot || !String(screenshot).trim()) {
      return NextResponse.json(
        { success: false, message: 'Please upload your Inbox screenshot proof before submitting.' },
        { status: 400 }
      );
    }

    // Check for existing pending task
    const existingPending = await db.collection('freeplay_tasks').findOne({
      $or: [
        { userId: user._id.toString() },
        { email: user.email.toLowerCase().trim() },
      ],
      status: 'pending',
    });

    if (existingPending) {
      return NextResponse.json({
        success: false,
        message: 'You already have a Freeplay verification task pending staff review. Please wait for our desk to process it.',
      });
    }

    const resolvedTaskId = taskId || `FP-${Math.floor(100000 + Math.random() * 900000)}`;

    // Record submission into freeplay_tasks collection
    await db.collection('freeplay_tasks').insertOne({
      taskId: resolvedTaskId,
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      gameTitle: String(gameTitle).trim(),
      screenshot,
      amount: configuredAmount,
      status: 'pending',
      createdAt: new Date(),
    });

    // Create an account request with freeplay attached so Coin Desk / Staff can approve
    await db.collection('account_requests').insertOne({
      userId: user._id.toString(),
      userName: user.username,
      userEmail: user.email,
      gameTitle: String(gameTitle).trim(),
      requestType: 'ACCOUNT_CREATION',
      status: 'PENDING',
      freeplayPending: true,
      freeplayAmount: configuredAmount,
      freeplayScreenshot: screenshot,
      freeplayTaskId: resolvedTaskId,
      createdAt: new Date(),
    });

    // Notify staff
    notifyStaff({
      type: 'freeplay_task_submitted',
      title: 'Freeplay Task Proof Submitted 🎁',
      message: `Player ${user.username} submitted Inbox screenshot for $${configuredAmount.toFixed(2)} Freeplay on ${gameTitle}.`,
      data: {
        userId: user._id.toString(),
        username: user.username,
        gameTitle,
        amount: String(configuredAmount),
        taskId: resolvedTaskId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `🎉 Freeplay task submitted! Our 24/7 staff will verify your Inbox screenshot and load your $${configuredAmount.toFixed(2)} Freeplay credentials shortly.`,
      taskId: resolvedTaskId,
      amount: configuredAmount,
    });
  } catch (err) {
    console.error('Freeplay Task submission error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
