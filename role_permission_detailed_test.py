#!/usr/bin/env python3
"""
Detailed Role-Permission Mapping API Test Suite
Tests all CRUD operations and edge cases for the Role-Permission Mapping system
"""

import requests
import json
from datetime import datetime

class DetailedRolePermissionTester:
    def __init__(self, base_url="https://unified-opp-mgmt.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.test_data = {}

    def authenticate(self):
        """Authenticate and get token"""
        print("🔐 Authenticating...")
        response = requests.post(
            f"{self.api_url}/auth/login",
            json={"email": "admin@erp.com", "password": "admin123"},
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['data']['access_token']
            print("✅ Authentication successful")
            return True
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            return False

    def get_headers(self):
        """Get headers with authentication"""
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.token}'
        }

    def setup_test_data(self):
        """Get test data (roles, menus, permissions)"""
        print("\n📋 Setting up test data...")
        
        # Get roles
        response = requests.get(f"{self.api_url}/roles", headers=self.get_headers())
        if response.status_code == 200:
            self.test_data['roles'] = response.json()['data']
            print(f"   Found {len(self.test_data['roles'])} roles")
        
        # Get menus
        response = requests.get(f"{self.api_url}/menus", headers=self.get_headers())
        if response.status_code == 200:
            self.test_data['menus'] = response.json()['data']
            print(f"   Found {len(self.test_data['menus'])} menus")
        
        # Get permissions
        response = requests.get(f"{self.api_url}/permissions", headers=self.get_headers())
        if response.status_code == 200:
            self.test_data['permissions'] = response.json()['data']
            print(f"   Found {len(self.test_data['permissions'])} permissions")
        
        return len(self.test_data.get('roles', [])) > 0 and len(self.test_data.get('menus', [])) > 0 and len(self.test_data.get('permissions', [])) > 0

    def test_create_role_permission_mapping(self):
        """Test creating role-permission mappings"""
        print("\n🔨 Testing Role-Permission Mapping Creation...")
        
        role = self.test_data['roles'][0]
        menu = self.test_data['menus'][0]
        permissions = self.test_data['permissions'][:2]  # Use first 2 permissions
        
        mapping_data = {
            "role_id": role['id'],
            "menu_id": menu['id'],
            "permission_ids": [p['id'] for p in permissions]
        }
        
        print(f"   Creating mapping: Role '{role['name']}' -> Menu '{menu['name']}' -> Permissions {[p['name'] for p in permissions]}")
        
        response = requests.post(
            f"{self.api_url}/role-permissions",
            json=mapping_data,
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            print("✅ Role-permission mapping created successfully")
            return True
        else:
            print(f"❌ Failed to create mapping: {response.status_code} - {response.text}")
            return False

    def test_get_all_mappings(self):
        """Test getting all role-permission mappings"""
        print("\n📋 Testing Get All Role-Permission Mappings...")
        
        response = requests.get(f"{self.api_url}/role-permissions", headers=self.get_headers())
        
        if response.status_code == 200:
            data = response.json()
            mappings = data.get('data', [])
            print(f"✅ Retrieved {len(mappings)} role-permission mappings")
            
            # Display mapping details
            for mapping in mappings:
                print(f"   - Role: {mapping.get('role_name', 'Unknown')} | Menu: {mapping.get('menu_name', 'Unknown')} | Permissions: {mapping.get('permission_names', [])}")
            
            return True
        else:
            print(f"❌ Failed to get mappings: {response.status_code} - {response.text}")
            return False

    def test_get_role_specific_permissions(self):
        """Test getting permissions for a specific role"""
        print("\n🎯 Testing Get Role-Specific Permissions...")
        
        role = self.test_data['roles'][0]
        
        response = requests.get(
            f"{self.api_url}/role-permissions/role/{role['id']}",
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            role_permissions = data.get('data', {})
            permissions_by_menu = role_permissions.get('permissions_by_menu', [])
            
            print(f"✅ Retrieved permissions for role '{role['name']}'")
            print(f"   Found permissions for {len(permissions_by_menu)} menus")
            
            for menu_perm in permissions_by_menu:
                print(f"   - Menu: {menu_perm.get('menu_name')} | Permissions: {[p['name'] for p in menu_perm.get('permissions', [])]}")
            
            return True
        else:
            print(f"❌ Failed to get role permissions: {response.status_code} - {response.text}")
            return False

    def test_update_mapping(self):
        """Test updating a role-permission mapping"""
        print("\n✏️  Testing Update Role-Permission Mapping...")
        
        # First get existing mappings to find one to update
        response = requests.get(f"{self.api_url}/role-permissions", headers=self.get_headers())
        
        if response.status_code != 200:
            print("❌ Failed to get existing mappings for update test")
            return False
        
        mappings = response.json().get('data', [])
        if not mappings:
            print("❌ No existing mappings found to update")
            return False
        
        mapping_to_update = mappings[0]
        mapping_id = mapping_to_update['id']
        
        # Update with different permissions
        new_permissions = [self.test_data['permissions'][0]['id']]  # Use only first permission
        
        update_data = {
            "permission_ids": new_permissions
        }
        
        print(f"   Updating mapping {mapping_id} with new permissions: {[self.test_data['permissions'][0]['name']]}")
        
        response = requests.put(
            f"{self.api_url}/role-permissions/{mapping_id}",
            json=update_data,
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            print("✅ Role-permission mapping updated successfully")
            return True
        else:
            print(f"❌ Failed to update mapping: {response.status_code} - {response.text}")
            return False

    def test_validation_errors(self):
        """Test validation and error handling"""
        print("\n🚫 Testing Validation and Error Handling...")
        
        tests_passed = 0
        total_tests = 4
        
        # Test 1: Invalid role ID
        invalid_data = {
            "role_id": "invalid-role-id",
            "menu_id": self.test_data['menus'][0]['id'],
            "permission_ids": [self.test_data['permissions'][0]['id']]
        }
        
        response = requests.post(f"{self.api_url}/role-permissions", json=invalid_data, headers=self.get_headers())
        if response.status_code == 404:
            print("   ✅ Invalid role ID correctly rejected")
            tests_passed += 1
        else:
            print(f"   ❌ Invalid role ID test failed: {response.status_code}")
        
        # Test 2: Invalid menu ID
        invalid_data = {
            "role_id": self.test_data['roles'][0]['id'],
            "menu_id": "invalid-menu-id",
            "permission_ids": [self.test_data['permissions'][0]['id']]
        }
        
        response = requests.post(f"{self.api_url}/role-permissions", json=invalid_data, headers=self.get_headers())
        if response.status_code == 404:
            print("   ✅ Invalid menu ID correctly rejected")
            tests_passed += 1
        else:
            print(f"   ❌ Invalid menu ID test failed: {response.status_code}")
        
        # Test 3: Invalid permission ID
        invalid_data = {
            "role_id": self.test_data['roles'][0]['id'],
            "menu_id": self.test_data['menus'][0]['id'],
            "permission_ids": ["invalid-permission-id"]
        }
        
        response = requests.post(f"{self.api_url}/role-permissions", json=invalid_data, headers=self.get_headers())
        if response.status_code == 404:
            print("   ✅ Invalid permission ID correctly rejected")
            tests_passed += 1
        else:
            print(f"   ❌ Invalid permission ID test failed: {response.status_code}")
        
        # Test 4: Missing required fields
        invalid_data = {
            "role_id": self.test_data['roles'][0]['id']
            # Missing menu_id and permission_ids
        }
        
        response = requests.post(f"{self.api_url}/role-permissions", json=invalid_data, headers=self.get_headers())
        if response.status_code == 400:
            print("   ✅ Missing required fields correctly rejected")
            tests_passed += 1
        else:
            print(f"   ❌ Missing fields test failed: {response.status_code}")
        
        print(f"   Validation tests: {tests_passed}/{total_tests} passed")
        return tests_passed == total_tests

    def test_delete_operations(self):
        """Test delete operations"""
        print("\n🗑️  Testing Delete Operations...")
        
        role = self.test_data['roles'][0]
        menu = self.test_data['menus'][0]
        
        # Test delete by role and menu
        response = requests.delete(
            f"{self.api_url}/role-permissions/role/{role['id']}/menu/{menu['id']}",
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            print(f"✅ Successfully deleted mapping for role '{role['name']}' and menu '{menu['name']}'")
        else:
            print(f"❌ Failed to delete by role/menu: {response.status_code} - {response.text}")
            return False
        
        # Test delete non-existent mapping
        response = requests.delete(
            f"{self.api_url}/role-permissions/non-existent-id",
            headers=self.get_headers()
        )
        
        if response.status_code == 404:
            print("✅ Non-existent mapping deletion correctly returned 404")
            return True
        else:
            print(f"❌ Non-existent mapping deletion test failed: {response.status_code}")
            return False

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Detailed Role-Permission Mapping Tests")
        print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)
        
        # Initialize database
        print("🔧 Initializing database...")
        response = requests.post(f"{self.api_url}/init-db")
        if response.status_code == 200:
            print("✅ Database initialized")
        
        # Authenticate
        if not self.authenticate():
            return False
        
        # Setup test data
        if not self.setup_test_data():
            print("❌ Failed to setup test data")
            return False
        
        # Run tests
        tests = [
            ("Create Role-Permission Mapping", self.test_create_role_permission_mapping),
            ("Get All Mappings", self.test_get_all_mappings),
            ("Get Role-Specific Permissions", self.test_get_role_specific_permissions),
            ("Update Mapping", self.test_update_mapping),
            ("Validation and Error Handling", self.test_validation_errors),
            ("Delete Operations", self.test_delete_operations)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                print(f"❌ Test '{test_name}' failed with exception: {str(e)}")
        
        # Final results
        print("\n" + "="*60)
        print("DETAILED TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {passed}/{total}")
        print(f"✅ Success rate: {(passed/total*100):.1f}%" if total > 0 else "No tests run")
        
        if passed == total:
            print("🎉 All detailed role-permission mapping tests passed!")
            return True
        else:
            print("⚠️  Some detailed tests failed!")
            return False

if __name__ == "__main__":
    tester = DetailedRolePermissionTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)