import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Import shadcn components
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from '../hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

// Icons
import { Shield, Settings, Key, Plus, Edit, Trash2, Users, Menu as MenuIcon, ChevronRight, Check, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RolePermissionsManagement = () => {
  const [roles, setRoles] = useState([]);
  const [menus, setMenus] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState([]);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [permissionChanges, setPermissionChanges] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, menusRes, permissionsRes, rolePermissionsRes] = await Promise.all([
        axios.get(`${API}/roles`),
        axios.get(`${API}/menus`),
        axios.get(`${API}/permissions`),
        axios.get(`${API}/role-permissions`)
      ]);

      if (rolesRes.data.success) setRoles(rolesRes.data.data);
      if (menusRes.data.success) setMenus(menusRes.data.data);
      if (permissionsRes.data.success) setPermissions(permissionsRes.data.data);
      if (rolePermissionsRes.data.success) setRolePermissions(rolePermissionsRes.data.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (roleId) => {
    try {
      const response = await axios.get(`${API}/role-permissions/role/${roleId}`);
      if (response.data.success) {
        setSelectedRolePermissions(response.data.data.permissions_by_menu || []);
        
        // Initialize permission changes state
        const changes = {};
        response.data.data.permissions_by_menu?.forEach(menuPerm => {
          changes[menuPerm.menu_id] = menuPerm.permissions.map(p => p.id);
        });
        setPermissionChanges(changes);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch role permissions",
        variant: "destructive",
      });
    }
  };

  const handleManagePermissions = (role) => {
    setSelectedRole(role);
    fetchRolePermissions(role.id);
    setIsManageDialogOpen(true);
  };

  const handlePermissionChange = (menuId, permissionId, checked) => {
    setPermissionChanges(prev => {
      const menuPermissions = prev[menuId] || [];
      if (checked) {
        return {
          ...prev,
          [menuId]: [...menuPermissions.filter(id => id !== permissionId), permissionId]
        };
      } else {
        return {
          ...prev,
          [menuId]: menuPermissions.filter(id => id !== permissionId)
        };
      }
    });
  };

  const handleSavePermissions = async () => {
    try {
      const promises = [];
      
      // Process each menu's permissions
      for (const menuId of Object.keys(permissionChanges)) {
        const permissionIds = permissionChanges[menuId];
        
        if (permissionIds.length > 0) {
          // Create or update role-permission mapping
          promises.push(
            axios.post(`${API}/role-permissions`, {
              role_id: selectedRole.id,
              menu_id: menuId,
              permission_ids: permissionIds
            })
          );
        } else {
          // Remove role-permission mapping if no permissions selected
          promises.push(
            axios.delete(`${API}/role-permissions/role/${selectedRole.id}/menu/${menuId}`)
              .catch(err => {
                // Ignore 404 errors for non-existent mappings
                if (err.response?.status !== 404) throw err;
              })
          );
        }
      }

      await Promise.all(promises);

      toast({
        title: "Success",
        description: "Role permissions updated successfully",
      });

      setIsManageDialogOpen(false);
      fetchData(); // Refresh all data
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update permissions",
        variant: "destructive",
      });
    }
  };

  const getRolePermissionCount = (roleId) => {
    return rolePermissions.filter(rp => rp.role_id === roleId).length;
  };

  const getMenuPermissionStatus = (menuId) => {
    const currentPermissions = permissionChanges[menuId] || [];
    return currentPermissions.length;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Role Permissions Management</h2>
          <p className="text-slate-600">Assign permissions to roles for different system menus</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Overview Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Roles</p>
                    <p className="text-3xl font-bold text-slate-900">{roles.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">System Menus</p>
                    <p className="text-3xl font-bold text-slate-900">{menus.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <MenuIcon className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Permissions</p>
                    <p className="text-3xl font-bold text-slate-900">{permissions.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100">
                    <Key className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Active Mappings</p>
                    <p className="text-3xl font-bold text-slate-900">{rolePermissions.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100">
                    <Settings className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Roles Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>
                Manage permissions for each role in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Assigned Menus</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4 text-slate-500" />
                          <span>{role.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{role.description || 'No description'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getRolePermissionCount(role.id)} menus
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={role.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleManagePermissions(role)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Manage Permissions
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          {/* Permission Matrix */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                Overview of all role-permission assignments across the system
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Role</TableHead>
                      <TableHead>Menu</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolePermissions.map((rp) => (
                      <TableRow key={rp.id}>
                        <TableCell className="font-medium">
                          <Badge variant="secondary">{rp.role_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <MenuIcon className="h-4 w-4 text-slate-500" />
                            <span>{rp.menu_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {rp.permission_names.map((permName, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {permName}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-800"
                            onClick={() => {
                              // Handle remove mapping
                              // Implementation can be added here
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Permissions Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription>
              Assign permissions to this role for different system menus
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-6">
              {menus.map((menu) => (
                <Card key={menu.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MenuIcon className="h-5 w-5 text-slate-600" />
                        <CardTitle className="text-lg">{menu.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {menu.path}
                        </Badge>
                      </div>
                      <Badge variant="secondary">
                        {getMenuPermissionStatus(menu.id)} selected
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${menu.id}-${permission.id}`}
                            checked={(permissionChanges[menu.id] || []).includes(permission.id)}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(menu.id, permission.id, checked)
                            }
                          />
                          <Label 
                            htmlFor={`${menu.id}-${permission.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {permission.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSavePermissions}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="mr-2 h-4 w-4" />
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolePermissionsManagement;