import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getSessionUser, ROLES, safeIdFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET list of players
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const db = await getDb();
    const usersCol = db.collection('users');

    const query = {};
    if (search) {
      query.$or = [
        { username: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }

    const users = await usersCol.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u._id ? u._id.toString() : u.id,
        username: u.username,
        email: u.email,
        phone: u.phone || '',
        role: u.role,
        balanceSC: u.balanceSC || 0,
        balanceGC: u.balanceGC || 0,
        vipTier: u.vipTier || 'Bronze Panda',
        kycStatus: u.kycStatus || 'unverified',
        isBanned: !!u.isBanned,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH toggle ban, reset password, or update user
export async function PATCH(req) {
  try {
    const session = await getSessionUser();
    if (!session || (session.role !== ROLES.SUPER_ADMIN && session.role !== ROLES.OPERATION_ADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isBanned, vipTier, kycStatus, newPassword } = body;

    const db = await getDb();
    const usersCol = db.collection('users');

    const filter = safeIdFilter(userId);

    const updateFields = { updatedAt: new Date() };
    if (isBanned !== undefined) updateFields.isBanned = isBanned;
    if (vipTier) updateFields.vipTier = vipTier;
    if (kycStatus) updateFields.kycStatus = kycStatus;
    if (newPassword && newPassword.trim().length >= 4) {
      updateFields.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    }

    await usersCol.updateOne(filter, { $set: updateFields });

    return NextResponse.json({
      success: true,
      message: newPassword ? 'Password reset successfully!' : 'User status updated successfully.',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

