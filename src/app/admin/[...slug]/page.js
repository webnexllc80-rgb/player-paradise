'use client';

import React from 'react';
import AdminPortal from '../page';
import { useParams } from 'next/navigation';

export default function AdminCatchAllPage() {
  const params = useParams();
  const slug = params?.slug;
  const initialTab = Array.isArray(slug) ? slug[0] : (slug || 'overview');

  return <AdminPortal initialTab={initialTab} />;
}
