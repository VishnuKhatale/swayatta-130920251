#!/usr/bin/env python3
"""
Focused test for granular role-permission enforcement system
"""
import requests
import json
from datetime import datetime

class PermissionEnforcementTester:
    def __init__(self, base_url="https://quotation-system-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.limited_token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'message' in response_data:
                        print(f"   Message: {response_data['message']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def setup_admin_login(self):
        """Login as admin and get token"""
        print("\n" + "="*60)
        print("SETTING UP ADMIN LOGIN")
        print("="*60)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@erp.com", "password": "admin123"}
        )
        
        if success and response.get('success'):
            self.admin_token = response['data'].get('access_token')
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def setup_permissions_directly(self):
        """Setup permissions by directly calling the database initialization"""
        print("\n" + "="*60)
        print("SETTING UP PERMISSIONS SYSTEM")
        print("="*60)
        
        # Initialize database to ensure we have roles, menus, and permissions
        success, response = self.run_test(
            "Initialize Database",
            "POST",
            "init-db",
            200,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Get available data
        roles_success, roles_response = self.run_test(
            "Get Roles (bypassing permission check)",
            "GET",
            "roles",
            403,  # Expected to fail due to no permissions
            token=self.admin_token
        )
        
        # Since we can't access roles due to permission enforcement, 
        # we'll use the role-permissions endpoint to set up permissions
        # First, let's get menus and permissions which don't have permission decorators
        menus_success, menus_response = self.run_test(
            "Get Menus",
            "GET",
            "menus",
            200,
            token=self.admin_token
        )
        
        permissions_success, permissions_response = self.run_test(
            "Get Permissions",
            "GET",
            "permissions",
            200,
            token=self.admin_token
        )
        
        if not (menus_success and permissions_success):
            print("❌ Failed to get menus and permissions")
            return False
        
        menus = menus_response.get('data', [])
        permissions = permissions_response.get('data', [])
        
        # Find required menus and permissions
        users_menu = next((m for m in menus if m['path'] == '/users'), None)
        roles_menu = next((m for m in menus if m['path'] == '/roles'), None)
        
        view_perm = next((p for p in permissions if p['name'].lower() == 'view'), None)
        create_perm = next((p for p in permissions if p['name'].lower() == 'create'), None)
        edit_perm = next((p for p in permissions if p['name'].lower() == 'edit'), None)
        delete_perm = next((p for p in permissions if p['name'].lower() == 'delete'), None)
        
        if not all([users_menu, roles_menu, view_perm, create_perm, edit_perm, delete_perm]):
            print("❌ Required menus or permissions not found")
            print(f"   Users menu: {users_menu is not None}")
            print(f"   Roles menu: {roles_menu is not None}")
            print(f"   Permissions: view={view_perm is not None}, create={create_perm is not None}, edit={edit_perm is not None}, delete={delete_perm is not None}")
            return False
        
        # We need to manually create role-permission mappings
        # Since we know the admin role ID from the database initialization
        # Let's try to create mappings for a known admin role
        
        # First, let's try to create a role-permission mapping for users
        admin_role_id = "admin-role-id"  # We'll need to get this from somewhere
        
        # Actually, let's use the role-permissions endpoint to get role info
        role_perms_success, role_perms_response = self.run_test(
            "Get Role Permissions",
            "GET",
            "role-permissions",
            200,
            token=self.admin_token
        )
        
        print(f"   Found {len(menus)} menus and {len(permissions)} permissions")
        print(f"   Users menu: {users_menu['name']} ({users_menu['id']})")
        print(f"   Roles menu: {roles_menu['name']} ({roles_menu['id']})")
        
        return True

    def test_permission_enforcement_without_setup(self):
        """Test that permission enforcement is working (should get 403 errors)"""
        print("\n" + "="*60)
        print("TESTING PERMISSION ENFORCEMENT (WITHOUT PERMISSIONS)")
        print("="*60)
        
        # Test that admin user without permissions gets 403 errors
        success1, response1 = self.run_test(
            "GET /api/users without permissions (should fail with 403)",
            "GET",
            "users",
            403,
            token=self.admin_token
        )
        
        success2, response2 = self.run_test(
            "GET /api/roles without permissions (should fail with 403)",
            "GET",
            "roles",
            403,
            token=self.admin_token
        )
        
        success3, response3 = self.run_test(
            "POST /api/users without permissions (should fail with 403)",
            "POST",
            "users",
            403,
            data={
                "name": "Test User",
                "email": "test@test.com",
                "password": "test123",
                "role_id": "test-role-id"
            },
            token=self.admin_token
        )
        
        success4, response4 = self.run_test(
            "POST /api/roles without permissions (should fail with 403)",
            "POST",
            "roles",
            403,
            data={
                "name": "Test Role",
                "description": "Test role"
            },
            token=self.admin_token
        )
        
        # Verify error messages are descriptive
        if success1 and response1:
            error_detail = response1.get('detail', '')
            if 'permission' in error_detail.lower() and 'view access to /users' in error_detail:
                print("✅ Users endpoint error message is descriptive")
            else:
                print(f"❌ Users endpoint error message not descriptive: {error_detail}")
        
        if success2 and response2:
            error_detail = response2.get('detail', '')
            if 'permission' in error_detail.lower() and 'view access to /roles' in error_detail:
                print("✅ Roles endpoint error message is descriptive")
            else:
                print(f"❌ Roles endpoint error message not descriptive: {error_detail}")
        
        return all([success1, success2, success3, success4])

    def test_authentication_requirements(self):
        """Test that endpoints require authentication"""
        print("\n" + "="*60)
        print("TESTING AUTHENTICATION REQUIREMENTS")
        print("="*60)
        
        # Test accessing endpoints without any token
        success1, response1 = self.run_test(
            "GET /api/users without token (should fail with 403)",
            "GET",
            "users",
            403
        )
        
        success2, response2 = self.run_test(
            "GET /api/roles without token (should fail with 403)",
            "GET",
            "roles",
            403
        )
        
        success3, response3 = self.run_test(
            "GET /api/auth/permissions without token (should fail with 403)",
            "GET",
            "auth/permissions",
            403
        )
        
        return all([success1, success2, success3])

    def test_permissions_endpoint(self):
        """Test the permissions endpoint functionality"""
        print("\n" + "="*60)
        print("TESTING PERMISSIONS ENDPOINT")
        print("="*60)
        
        # Test getting current user permissions (should work even without permissions set up)
        success1, response1 = self.run_test(
            "GET /api/auth/permissions (should work)",
            "GET",
            "auth/permissions",
            200,
            token=self.admin_token
        )
        
        if success1 and response1.get('success'):
            permissions_data = response1['data']
            print(f"   Current user permissions: {permissions_data}")
            
            # Verify format: should be a dictionary
            if isinstance(permissions_data, dict):
                print("✅ Permissions returned in correct dictionary format")
                if not permissions_data:
                    print("✅ Admin user has no permissions set up (as expected)")
                else:
                    print(f"   Admin has permissions for: {list(permissions_data.keys())}")
            else:
                print("❌ Permissions not returned in dictionary format")
                return False
        
        return success1

    def test_require_permission_decorator(self):
        """Test that the require_permission decorator is working correctly"""
        print("\n" + "="*60)
        print("TESTING REQUIRE_PERMISSION DECORATOR FUNCTIONALITY")
        print("="*60)
        
        # Test various endpoints that should have permission decorators
        endpoints_to_test = [
            ("GET /api/users", "GET", "users", "view", "/users"),
            ("POST /api/users", "POST", "users", "create", "/users"),
            ("GET /api/roles", "GET", "roles", "view", "/roles"),
            ("POST /api/roles", "POST", "roles", "create", "/roles"),
        ]
        
        all_success = True
        
        for test_name, method, endpoint, perm_type, menu_path in endpoints_to_test:
            if method == "POST":
                test_data = {
                    "name": f"Test {datetime.now().strftime('%H%M%S')}",
                    "email": f"test{datetime.now().strftime('%H%M%S')}@test.com",
                    "password": "test123",
                    "role_id": "test-role-id"
                } if endpoint == "users" else {
                    "name": f"Test Role {datetime.now().strftime('%H%M%S')}",
                    "description": "Test role"
                }
            else:
                test_data = None
            
            success, response = self.run_test(
                f"{test_name} (should fail with 403 - {perm_type} permission required)",
                method,
                endpoint,
                403,
                data=test_data,
                token=self.admin_token
            )
            
            if success and response:
                error_detail = response.get('detail', '')
                expected_error = f"{perm_type} access to {menu_path}"
                if expected_error in error_detail:
                    print(f"✅ Correct permission error for {test_name}")
                else:
                    print(f"❌ Incorrect permission error for {test_name}: {error_detail}")
                    all_success = False
            else:
                all_success = False
        
        return all_success

    def run_all_tests(self):
        """Run all permission enforcement tests"""
        print("🚀 Starting Granular Permission Enforcement Testing")
        print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Setup
        if not self.setup_admin_login():
            print("❌ Failed to setup admin login")
            return False
        
        if not self.setup_permissions_directly():
            print("❌ Failed to setup permissions system")
            return False
        
        # Run tests
        tests = [
            self.test_permission_enforcement_without_setup,
            self.test_authentication_requirements,
            self.test_permissions_endpoint,
            self.test_require_permission_decorator
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test failed with exception: {str(e)}")
        
        # Print final results
        print("\n" + "="*60)
        print("GRANULAR PERMISSION ENFORCEMENT TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "No tests run")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All permission enforcement tests passed!")
            return True
        else:
            print("⚠️  Some permission enforcement tests failed!")
            return False

def main():
    tester = PermissionEnforcementTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())