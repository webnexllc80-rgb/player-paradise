import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const candidates = [
      path.join(process.cwd(), 'public', 'download', 'players-paradise.apk'),
      path.join(process.cwd(), 'public', 'players-paradise.apk'),
      path.join(process.cwd(), 'public', 'download', 'vegas-one.apk'),
      path.join(process.cwd(), 'public', 'vegas-one.apk'),
    ];

    let apkPath = null;
    for (const p of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        apkPath = p;
        break;
      }
    }

    if (!apkPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'Release APK is currently being generated. Please retry in a few moments or contact support.',
        },
        { status: 404 }
      );
    }

    const stat = fs.statSync(/*turbopackIgnore: true*/ apkPath);
    const fileStream = fs.createReadStream(/*turbopackIgnore: true*/ apkPath);

    // Convert node read stream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(readableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="players-paradise.apk"',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  } catch (error) {
    console.error('APK stream error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download APK.' },
      { status: 500 }
    );
  }
}
