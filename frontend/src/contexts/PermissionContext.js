import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState({});
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Get user info and permissions
      const [userResponse, permissionsResponse] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_URL}/api/auth/permissions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (userResponse.data.success && permissionsResponse.data.success) {
        const userData = userResponse.data.data;
        setUserRole(userData.role_name || null);
        setPermissions(permissionsResponse.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissions({});
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const isAdmin = () => {
    return userRole && userRole.toLowerCase() === 'admin';
  };

  const hasPermission = (menuPath, permissionType) => {
    // Admin bypasses all permission checks
    if (isAdmin()) {
      return true;
    }
    
    if (!permissions || !menuPath || !permissionType) {
      return false;
    }
    
    const menuPermissions = permissions[menuPath] || [];
    return menuPermissions.includes(permissionType);
  };

  const canView = (menuPath) => hasPermission(menuPath, 'view');
  const canCreate = (menuPath) => hasPermission(menuPath, 'create');
  const canEdit = (menuPath) => hasPermission(menuPath, 'edit');
  const canDelete = (menuPath) => hasPermission(menuPath, 'delete');

  const value = {
    permissions,
    userRole,
    isAdmin,
    loading,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    refreshPermissions: fetchPermissions
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};