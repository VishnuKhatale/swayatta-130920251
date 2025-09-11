import React from 'react';
import { usePermissions } from '../contexts/PermissionContext';

const ProtectedComponent = ({ 
  children, 
  menuPath, 
  permission, 
  fallback = null,
  requireAll = false, // If true, user must have ALL specified permissions
  permissions = [] // Array of permissions for multiple checks
}) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return fallback;
  }

  // Single permission check
  if (menuPath && permission) {
    if (!hasPermission(menuPath, permission)) {
      return fallback;
    }
  }

  // Multiple permissions check
  if (menuPath && permissions.length > 0) {
    const permissionChecks = permissions.map(perm => hasPermission(menuPath, perm));
    
    if (requireAll) {
      // User must have ALL permissions
      if (!permissionChecks.every(check => check)) {
        return fallback;
      }
    } else {
      // User must have at least ONE permission
      if (!permissionChecks.some(check => check)) {
        return fallback;
      }
    }
  }

  return children;
};

export default ProtectedComponent;