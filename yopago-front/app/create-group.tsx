import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import CreateGroupForm from '../components/group/CreateGroupForm';

export default function CreateGroupScreen() {
  return (
    <ProtectedRoute>
      <ThemedView style={styles.container}>
        <CreateGroupForm />
      </ThemedView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
