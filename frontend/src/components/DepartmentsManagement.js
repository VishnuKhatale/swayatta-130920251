import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Import shadcn components
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from '../hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

// Icons
import { Building, Plus, Edit, Trash2, ChevronRight, Users } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DepartmentsManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('departments');
  
  // Department dialogs state
  const [isCreateDeptDialogOpen, setIsCreateDeptDialogOpen] = useState(false);
  const [isEditDeptDialogOpen, setIsEditDeptDialogOpen] = useState(false);
  const [isDeleteDeptDialogOpen, setIsDeleteDeptDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  
  // Sub-department dialogs state
  const [isCreateSubDeptDialogOpen, setIsCreateSubDeptDialogOpen] = useState(false);
  const [isEditSubDeptDialogOpen, setIsEditSubDeptDialogOpen] = useState(false);
  const [isDeleteSubDeptDialogOpen, setIsDeleteSubDeptDialogOpen] = useState(false);
  const [selectedSubDepartment, setSelectedSubDepartment] = useState(null);
  const [selectedDeptForSubDept, setSelectedDeptForSubDept] = useState(null);
  const [subDepartments, setSubDepartments] = useState([]);
  
  // Form data
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    description: ''
  });
  
  const [subDeptFormData, setSubDeptFormData] = useState({
    name: '',
    description: ''
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API}/departments`);
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch departments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubDepartments = async (departmentId) => {
    try {
      const response = await axios.get(`${API}/departments/${departmentId}/sub-departments`);
      if (response.data.success) {
        setSubDepartments(response.data.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch sub-departments",
        variant: "destructive",
      });
    }
  };

  // Department CRUD operations
  const handleCreateDepartment = async () => {
    if (!deptFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Department name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(`${API}/departments`, deptFormData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Department created successfully",
        });
        setIsCreateDeptDialogOpen(false);
        setDeptFormData({ name: '', description: '' });
        fetchDepartments();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create department",
        variant: "destructive",
      });
    }
  };

  const handleEditDepartment = async () => {
    if (!deptFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Department name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.put(`${API}/departments/${selectedDepartment.id}`, deptFormData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Department updated successfully",
        });
        setIsEditDeptDialogOpen(false);
        setSelectedDepartment(null);
        setDeptFormData({ name: '', description: '' });
        fetchDepartments();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update department",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDepartment = async () => {
    try {
      const response = await axios.delete(`${API}/departments/${selectedDepartment.id}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Department deleted successfully",
        });
        setIsDeleteDeptDialogOpen(false);
        setSelectedDepartment(null);
        fetchDepartments();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete department",
        variant: "destructive",
      });
    }
  };

  // Sub-department CRUD operations
  const handleCreateSubDepartment = async () => {
    if (!subDeptFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Sub-department name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(`${API}/departments/${selectedDeptForSubDept}/sub-departments`, subDeptFormData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Sub-department created successfully",
        });
        setIsCreateSubDeptDialogOpen(false);
        setSubDeptFormData({ name: '', description: '' });
        fetchSubDepartments(selectedDeptForSubDept);
        fetchDepartments(); // Refresh to update sub-department count
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create sub-department",
        variant: "destructive",
      });
    }
  };

  const handleEditSubDepartment = async () => {
    if (!subDeptFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Sub-department name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.put(`${API}/sub-departments/${selectedSubDepartment.id}`, subDeptFormData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Sub-department updated successfully",
        });
        setIsEditSubDeptDialogOpen(false);
        setSelectedSubDepartment(null);
        setSubDeptFormData({ name: '', description: '' });
        fetchSubDepartments(selectedSubDepartment.department_id);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update sub-department",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubDepartment = async () => {
    try {
      const response = await axios.delete(`${API}/sub-departments/${selectedSubDepartment.id}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Sub-department deleted successfully",
        });
        setIsDeleteSubDeptDialogOpen(false);
        const deptId = selectedSubDepartment.department_id;
        setSelectedSubDepartment(null);
        fetchSubDepartments(deptId);
        fetchDepartments(); // Refresh to update sub-department count
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete sub-department",
        variant: "destructive",
      });
    }
  };

  // Dialog helpers
  const openEditDeptDialog = (dept) => {
    setSelectedDepartment(dept);
    setDeptFormData({
      name: dept.name,
      description: dept.description || ''
    });
    setIsEditDeptDialogOpen(true);
  };

  const openDeleteDeptDialog = (dept) => {
    setSelectedDepartment(dept);
    setIsDeleteDeptDialogOpen(true);
  };

  const openCreateSubDeptDialog = (deptId) => {
    setSelectedDeptForSubDept(deptId);
    fetchSubDepartments(deptId);
    setIsCreateSubDeptDialogOpen(true);
  };

  const openEditSubDeptDialog = (subDept) => {
    setSelectedSubDepartment(subDept);
    setSubDeptFormData({
      name: subDept.name,
      description: subDept.description || ''
    });
    setIsEditSubDeptDialogOpen(true);
  };

  const openDeleteSubDeptDialog = (subDept) => {
    setSelectedSubDepartment(subDept);
    setIsDeleteSubDeptDialogOpen(true);
  };

  const viewSubDepartments = (dept) => {
    setSelectedDeptForSubDept(dept.id);
    fetchSubDepartments(dept.id);
    setActiveTab('sub-departments');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Departments Management</h2>
          <p className="text-slate-600">Manage organizational departments and sub-departments</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="sub-departments">Sub-Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Departments</CardTitle>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setIsCreateDeptDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Sub-Departments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.description || 'No description'}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{dept.sub_departments_count || 0}</Badge>
                          {dept.sub_departments_count > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => viewSubDepartments(dept)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={dept.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(dept.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openCreateSubDeptDialog(dept.id)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDeptDialog(dept)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-800"
                            onClick={() => openDeleteDeptDialog(dept)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sub-departments">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Sub-Departments</CardTitle>
                {selectedDeptForSubDept && (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setIsCreateSubDeptDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Sub-Department
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedDeptForSubDept ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subDepartments.map((subDept) => (
                      <TableRow key={subDept.id}>
                        <TableCell className="font-medium">{subDept.name}</TableCell>
                        <TableCell>{subDept.description || 'No description'}</TableCell>
                        <TableCell>
                          <Badge className={subDept.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {subDept.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(subDept.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditSubDeptDialog(subDept)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-800"
                              onClick={() => openDeleteSubDeptDialog(subDept)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-slate-600">
                  Select a department to view its sub-departments
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Dialogs */}
      <Dialog open={isCreateDeptDialogOpen} onOpenChange={setIsCreateDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Department</DialogTitle>
            <DialogDescription>Add a new department to the organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                value={deptFormData.name}
                onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                placeholder="Enter department name"
              />
            </div>
            <div>
              <Label htmlFor="dept-description">Description</Label>
              <Input
                id="dept-description"
                value={deptFormData.description}
                onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                placeholder="Enter department description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDepartment} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDeptDialogOpen} onOpenChange={setIsEditDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-dept-name">Department Name *</Label>
              <Input
                id="edit-dept-name"
                value={deptFormData.name}
                onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                placeholder="Enter department name"
              />
            </div>
            <div>
              <Label htmlFor="edit-dept-description">Description</Label>
              <Input
                id="edit-dept-description"
                value={deptFormData.description}
                onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                placeholder="Enter department description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditDepartment} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDeptDialogOpen} onOpenChange={setIsDeleteDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the department "{selectedDepartment?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteDepartment} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-Department Dialogs */}
      <Dialog open={isCreateSubDeptDialogOpen} onOpenChange={setIsCreateSubDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sub-Department</DialogTitle>
            <DialogDescription>Add a new sub-department</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subdept-name">Sub-Department Name *</Label>
              <Input
                id="subdept-name"
                value={subDeptFormData.name}
                onChange={(e) => setSubDeptFormData({ ...subDeptFormData, name: e.target.value })}
                placeholder="Enter sub-department name"
              />
            </div>
            <div>
              <Label htmlFor="subdept-description">Description</Label>
              <Input
                id="subdept-description"
                value={subDeptFormData.description}
                onChange={(e) => setSubDeptFormData({ ...subDeptFormData, description: e.target.value })}
                placeholder="Enter sub-department description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSubDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubDepartment} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Sub-Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditSubDeptDialogOpen} onOpenChange={setIsEditSubDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-Department</DialogTitle>
            <DialogDescription>Update sub-department information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-subdept-name">Sub-Department Name *</Label>
              <Input
                id="edit-subdept-name"
                value={subDeptFormData.name}
                onChange={(e) => setSubDeptFormData({ ...subDeptFormData, name: e.target.value })}
                placeholder="Enter sub-department name"
              />
            </div>
            <div>
              <Label htmlFor="edit-subdept-description">Description</Label>
              <Input
                id="edit-subdept-description"
                value={subDeptFormData.description}
                onChange={(e) => setSubDeptFormData({ ...subDeptFormData, description: e.target.value })}
                placeholder="Enter sub-department description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSubDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubDepartment} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Sub-Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteSubDeptDialogOpen} onOpenChange={setIsDeleteSubDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sub-Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the sub-department "{selectedSubDepartment?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteSubDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteSubDepartment} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Sub-Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentsManagement;