import {
  CaptureReceiptContent,
  type CaptureReceiptContentProps,
  type ReceiptProcessingPayload,
} from '@/components/group/CaptureReceiptContent';
import { type GroupMember } from '@/services/types';
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

interface CaptureReceiptModalProps {
  visible: boolean;
  groupId?: number;
  groupMembers?: GroupMember[];
  defaultPayerId?: number | null;
  onClose: () => void;
  onProcessed?: () => void;
  onReceiptReady?: (payload: ReceiptProcessingPayload) => void;
  processReceipt?: CaptureReceiptContentProps['processReceipt'];
}

export function CaptureReceiptModal({
  visible,
  groupId,
  groupMembers,
  defaultPayerId,
  onClose,
  onProcessed,
  onReceiptReady,
  processReceipt,
}: CaptureReceiptModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container]}>
        <CaptureReceiptContent
          groupId={groupId}
          groupMembers={groupMembers}
          defaultPayerId={defaultPayerId}
          onClose={onClose}
          onProcessed={onProcessed}
          onReceiptReady={onReceiptReady}
          processReceipt={processReceipt}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
