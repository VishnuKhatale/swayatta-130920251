#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ComprehensivePartnersAPITester:
    def __init__(self, base_url="https://service-delivery-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

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

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test authentication"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@erp.com", "password": "admin123"}
        )
        
        if success and response.get('success') and 'data' in response:
            self.token = response['data'].get('access_token')
            self.user_id = response['data'].get('user', {}).get('id')
            return True
        else:
            return False

    def get_master_data(self):
        """Get master data for testing"""
        master_data = {}
        
        # Get job functions
        success, response = self.run_test(
            "Get Job Functions",
            "GET",
            "master/job-functions",
            200
        )
        if success and response.get('success'):
            job_functions = response.get('data', [])
            if job_functions:
                master_data['job_function_id'] = job_functions[0]['job_function_id']
        
        # Get company types
        success, response = self.run_test(
            "Get Company Types",
            "GET",
            "master/company-types",
            200
        )
        if success and response.get('success'):
            company_types = response.get('data', [])
            if company_types:
                master_data['company_type_id'] = company_types[0]['company_type_id']
        
        # Get partner types
        success, response = self.run_test(
            "Get Partner Types",
            "GET",
            "master/partner-types",
            200
        )
        if success and response.get('success'):
            partner_types = response.get('data', [])
            if partner_types:
                master_data['partner_type_id'] = partner_types[0]['partner_type_id']
        
        # Get head of company
        success, response = self.run_test(
            "Get Head of Company",
            "GET",
            "master/head-of-company",
            200
        )
        if success and response.get('success'):
            head_of_company = response.get('data', [])
            if head_of_company:
                master_data['head_of_company_id'] = head_of_company[0]['head_of_company_id']
        
        return master_data

    def test_comprehensive_partners_api(self):
        """Test comprehensive Partners API scenarios"""
        print("\n" + "="*60)
        print("COMPREHENSIVE ENHANCED PARTNERS API TESTING")
        print("="*60)
        
        if not self.token:
            return False

        # Get master data
        master_data = self.get_master_data()
        if not master_data:
            return False

        timestamp = datetime.now().strftime('%H%M%S')
        
        # Test 1: Create partner with all fields
        partner_data = {
            "first_name": "Alice",
            "last_name": "Johnson",
            "email": f"alice.johnson.{timestamp}@testcompany.com",
            "phone": "9876543210",
            "job_function_id": master_data['job_function_id'],
            "company_name": f"Comprehensive Test Company {timestamp}",
            "company_type_id": master_data['company_type_id'],
            "partner_type_id": master_data['partner_type_id'],
            "head_of_company_id": master_data['head_of_company_id'],
            "gst_no": f"GST{timestamp}COMP",
            "pan_no": f"PAN{timestamp[:6]}"
        }
        
        success1, response1 = self.run_test(
            "Create Partner with All Fields",
            "POST",
            "partners",
            200,
            data=partner_data
        )
        
        if not success1:
            return False
        
        partner_id = response1.get('data', {}).get('partner_id')

        # Test 2: Create partner with minimal required fields (no optional fields)
        minimal_partner_data = {
            "first_name": "Bob",
            "email": f"bob.minimal.{timestamp}@testcompany.com",
            "job_function_id": master_data['job_function_id'],
            "company_name": f"Minimal Test Company {timestamp}",
            "company_type_id": master_data['company_type_id'],
            "partner_type_id": master_data['partner_type_id'],
            "head_of_company_id": master_data['head_of_company_id']
        }
        
        success2, response2 = self.run_test(
            "Create Partner with Minimal Required Fields",
            "POST",
            "partners",
            200,
            data=minimal_partner_data
        )
        
        minimal_partner_id = None
        if success2:
            minimal_partner_id = response2.get('data', {}).get('partner_id')

        # Test 3: Test email format validation
        invalid_email_formats = [
            "invalid-email",
            "test@",
            "@domain.com",
            "test.domain.com",
            "test@domain",
            ""
        ]
        
        email_validation_success = True
        for i, invalid_email in enumerate(invalid_email_formats):
            test_data = {
                **partner_data,
                "email": invalid_email,
                "first_name": f"EmailTest{i}",
                "company_name": f"Email Test Company {i} {timestamp}"
            }
            
            success, response = self.run_test(
                f"Invalid Email Format Test {i+1}: '{invalid_email}'",
                "POST",
                "partners",
                400,
                data=test_data
            )
            
            if not success:
                email_validation_success = False

        # Test 4: Test master data foreign key validation
        fk_validation_success = True
        
        # Invalid job function
        invalid_job_data = {
            **partner_data,
            "email": f"invalid.job.{timestamp}@test.com",
            "job_function_id": "invalid-job-function-id",
            "first_name": "InvalidJob",
            "company_name": f"Invalid Job Company {timestamp}"
        }
        
        success, response = self.run_test(
            "Invalid Job Function ID",
            "POST",
            "partners",
            400,
            data=invalid_job_data
        )
        
        if not success:
            fk_validation_success = False

        # Invalid company type
        invalid_company_type_data = {
            **partner_data,
            "email": f"invalid.comptype.{timestamp}@test.com",
            "company_type_id": "invalid-company-type-id",
            "first_name": "InvalidCompType",
            "company_name": f"Invalid Company Type {timestamp}"
        }
        
        success, response = self.run_test(
            "Invalid Company Type ID",
            "POST",
            "partners",
            400,
            data=invalid_company_type_data
        )
        
        if not success:
            fk_validation_success = False

        # Test 5: Test field length validations
        length_validation_success = True
        
        # GST number exactly 15 chars (should pass)
        valid_gst_data = {
            **partner_data,
            "email": f"valid.gst.{timestamp}@test.com",
            "gst_no": "123456789012345",  # Exactly 15 chars
            "first_name": "ValidGST",
            "company_name": f"Valid GST Company {timestamp}"
        }
        
        success, response = self.run_test(
            "Valid GST Number (15 chars)",
            "POST",
            "partners",
            200,
            data=valid_gst_data
        )
        
        if success:
            # Clean up
            valid_gst_partner_id = response.get('data', {}).get('partner_id')
            if valid_gst_partner_id:
                self.run_test(
                    "Cleanup Valid GST Partner",
                    "DELETE",
                    f"partners/{valid_gst_partner_id}",
                    200
                )
        else:
            length_validation_success = False

        # PAN number exactly 10 chars (should pass)
        valid_pan_data = {
            **partner_data,
            "email": f"valid.pan.{timestamp}@test.com",
            "pan_no": "1234567890",  # Exactly 10 chars
            "first_name": "ValidPAN",
            "company_name": f"Valid PAN Company {timestamp}",
            "gst_no": f"VPAN{timestamp}GST"
        }
        
        success, response = self.run_test(
            "Valid PAN Number (10 chars)",
            "POST",
            "partners",
            200,
            data=valid_pan_data
        )
        
        if success:
            # Clean up
            valid_pan_partner_id = response.get('data', {}).get('partner_id')
            if valid_pan_partner_id:
                self.run_test(
                    "Cleanup Valid PAN Partner",
                    "DELETE",
                    f"partners/{valid_pan_partner_id}",
                    200
                )
        else:
            length_validation_success = False

        # Test 6: Test phone number validation
        phone_validation_success = True
        
        valid_phone_formats = ["9876543210", "1234567890", "0123456789"]
        invalid_phone_formats = ["98765-43210", "987 654 3210", "+91-9876543210", "abcd123456"]
        
        # Test valid phone formats
        for i, valid_phone in enumerate(valid_phone_formats):
            test_data = {
                **partner_data,
                "email": f"valid.phone{i}.{timestamp}@test.com",
                "phone": valid_phone,
                "first_name": f"ValidPhone{i}",
                "company_name": f"Valid Phone Company {i} {timestamp}",
                "gst_no": f"VP{i}{timestamp}GST",
                "pan_no": f"VP{i}{timestamp[:5]}"
            }
            
            success, response = self.run_test(
                f"Valid Phone Format {i+1}: '{valid_phone}'",
                "POST",
                "partners",
                200,
                data=test_data
            )
            
            if success:
                # Clean up
                phone_partner_id = response.get('data', {}).get('partner_id')
                if phone_partner_id:
                    self.run_test(
                        f"Cleanup Valid Phone Partner {i+1}",
                        "DELETE",
                        f"partners/{phone_partner_id}",
                        200
                    )
            else:
                phone_validation_success = False

        # Test invalid phone formats
        for i, invalid_phone in enumerate(invalid_phone_formats):
            test_data = {
                **partner_data,
                "email": f"invalid.phone{i}.{timestamp}@test.com",
                "phone": invalid_phone,
                "first_name": f"InvalidPhone{i}",
                "company_name": f"Invalid Phone Company {i} {timestamp}"
            }
            
            success, response = self.run_test(
                f"Invalid Phone Format {i+1}: '{invalid_phone}'",
                "POST",
                "partners",
                400,
                data=test_data
            )
            
            if not success:
                phone_validation_success = False

        # Test 7: Test update operations with validation
        update_validation_success = True
        
        if partner_id:
            # Test valid update
            update_data = {
                "first_name": "Updated Alice",
                "company_name": f"Updated Comprehensive Company {timestamp}",
                "gst_no": f"UPD{timestamp}COMP",
                "pan_no": f"UPD{timestamp[:5]}"
            }
            
            success, response = self.run_test(
                "Valid Partner Update",
                "PUT",
                f"partners/{partner_id}",
                200,
                data=update_data
            )
            
            if not success:
                update_validation_success = False

            # Test update with invalid GST length
            invalid_update_data = {
                "gst_no": "1234567890123456"  # 16 chars - too long
            }
            
            success, response = self.run_test(
                "Update with Invalid GST Length",
                "PUT",
                f"partners/{partner_id}",
                400,
                data=invalid_update_data
            )
            
            if not success:
                update_validation_success = False

        # Test 8: Test GET partners with enriched data
        get_enriched_success = True
        
        success, response = self.run_test(
            "Get All Partners with Enriched Data",
            "GET",
            "partners",
            200
        )
        
        if success and response.get('success'):
            partners = response.get('data', [])
            if partners:
                # Check if partners have enriched data
                first_partner = partners[0]
                required_enriched_fields = ['job_function_name', 'company_type_name', 'partner_type_name', 'head_of_company_name']
                missing_enriched = [field for field in required_enriched_fields if field not in first_partner]
                if missing_enriched:
                    print(f"❌ Missing enriched fields in GET partners: {missing_enriched}")
                    get_enriched_success = False
                else:
                    print("✅ GET partners returns properly enriched data")
        else:
            get_enriched_success = False

        # Cleanup created partners
        if partner_id:
            self.run_test(
                "Cleanup Main Test Partner",
                "DELETE",
                f"partners/{partner_id}",
                200
            )
        
        if minimal_partner_id:
            self.run_test(
                "Cleanup Minimal Test Partner",
                "DELETE",
                f"partners/{minimal_partner_id}",
                200
            )

        # Calculate overall success
        all_validations = [
            success1, success2, email_validation_success, fk_validation_success,
            length_validation_success, phone_validation_success, update_validation_success,
            get_enriched_success
        ]
        
        passed_validations = sum(all_validations)
        total_validations = len(all_validations)
        
        print(f"\n   Comprehensive Validation Results: {passed_validations}/{total_validations} passed")
        
        return passed_validations == total_validations

    def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🚀 Starting Comprehensive Enhanced Partners API Testing...")
        
        # Test authentication
        if not self.test_authentication():
            print("❌ Authentication failed")
            return False
        
        # Test comprehensive partners API
        partners_success = self.test_comprehensive_partners_api()
        
        # Print final results
        print("\n" + "="*60)
        print("COMPREHENSIVE TEST RESULTS")
        print("="*60)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if partners_success:
            print("🎉 ALL COMPREHENSIVE PARTNERS TESTS PASSED!")
        else:
            print("❌ Some comprehensive tests failed.")
        
        return partners_success

if __name__ == "__main__":
    tester = ComprehensivePartnersAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)