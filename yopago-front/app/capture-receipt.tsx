import React from 'react';
import { CaptureReceiptContent } from '@/components/group/CaptureReceiptContent';
import { useLocalSearchParams } from 'expo-router';

export default function CaptureReceiptScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const parsedGroupId = groupId ? Number.parseInt(groupId, 10) : undefined;
  const safeGroupId = Number.isFinite(parsedGroupId) ? parsedGroupId : undefined;

  return <CaptureReceiptContent groupId={safeGroupId} />;
}
