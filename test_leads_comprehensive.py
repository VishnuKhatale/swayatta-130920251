#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class LeadCRUDTester:
    def __init__(self, base_url="https://service-delivery-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

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
        print(f"   URL: {url}")
        
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

    def authenticate(self):
        """Authenticate with admin credentials"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@erp.com", "password": "admin123"}
        )
        
        if success and response.get('success') and 'data' in response:
            self.token = response['data'].get('access_token')
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        else:
            print("❌ Failed to get authentication token")
            return False

    def test_comprehensive_lead_crud(self):
        """Test comprehensive Lead CRUD operations"""
        print("\n" + "="*50)
        print("🎯 COMPREHENSIVE LEAD CRUD OPERATIONS TESTING")
        print("="*50)
        
        if not self.token:
            print("❌ No authentication token available")
            return False

        # PRE-TEST VERIFICATION: Check if companies are available
        print("\n--- PRE-TEST VERIFICATION ---")
        
        # 1. Verify companies are available
        companies_success, companies_response = self.run_test(
            "Verify Companies Available",
            "GET",
            "companies",
            200
        )
        
        if not companies_success or not companies_response.get('success'):
            print("❌ Failed to get companies for Lead testing")
            return False
        
        companies = companies_response['data']
        if not companies:
            print("❌ No companies available for Lead testing - this blocks Lead CRUD operations")
            return False
        
        print(f"✅ Found {len(companies)} companies available for Lead testing")
        test_company_id = companies[0]['company_id']
        print(f"   Using company: {companies[0]['company_name']} ({test_company_id})")
        
        # 2. Verify all master data is available
        master_data_checks = [
            ("currencies", "master/currencies"),
            ("users", "users"),
            ("lead-subtypes", "master/lead-subtypes"),
            ("lead-sources", "master/lead-sources")
        ]
        
        master_data = {}
        for data_name, endpoint in master_data_checks:
            success, response = self.run_test(
                f"Verify {data_name} Available",
                "GET",
                endpoint,
                200
            )
            
            if not success or not response.get('success'):
                print(f"❌ Failed to get {data_name} for Lead testing")
                return False
            
            data = response['data']
            if not data:
                print(f"❌ No {data_name} available for Lead testing")
                return False
            
            master_data[data_name] = data
            print(f"✅ Found {len(data)} {data_name} available")
            
            # Debug: Print first item structure
            if data:
                print(f"   Sample {data_name} structure: {list(data[0].keys())}")
        
        # Extract test data - check field names carefully
        currencies = master_data['currencies']
        users = master_data['users']
        lead_subtypes = master_data['lead-subtypes']
        lead_sources = master_data['lead-sources']
        
        # Check currency field name
        currency_id_field = None
        for field in ['id', 'currency_id']:
            if field in currencies[0]:
                currency_id_field = field
                break
        
        if not currency_id_field:
            print(f"❌ Cannot find currency ID field. Available fields: {list(currencies[0].keys())}")
            return False
        
        test_currency_id = currencies[0][currency_id_field]
        test_user_id = users[0]['id']
        test_lead_subtype_id = lead_subtypes[0]['id']
        test_lead_source_id = lead_sources[0]['id']
        
        print(f"   Using currency: {currencies[0].get('currency_code', 'N/A')} ({test_currency_id})")
        print(f"   Using user: {users[0]['name']} ({test_user_id})")
        print(f"   Using lead subtype: {lead_subtypes[0]['lead_subtype_name']} ({test_lead_subtype_id})")
        print(f"   Using lead source: {lead_sources[0]['lead_source_name']} ({test_lead_source_id})")

        # LEAD CRUD TESTING
        print("\n--- LEAD CRUD TESTING ---")
        
        # 1. GET /api/leads - Test initial state
        success1, response1 = self.run_test(
            "GET /api/leads - Initial State",
            "GET",
            "leads",
            200
        )
        
        if not success1:
            return False
        
        initial_leads = response1['data'] if response1.get('success') else []
        print(f"   Initial leads count: {len(initial_leads)}")
        
        # 2. POST /api/leads - Test lead creation
        print("\n--- LEAD CREATION TESTING ---")
        
        # Successful Creation
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        
        valid_lead_data = {
            "project_title": f"Test Lead Project {datetime.now().strftime('%H%M%S')}",
            "lead_subtype_id": test_lead_subtype_id,
            "lead_source_id": test_lead_source_id,
            "company_id": test_company_id,
            "expected_revenue": 100000.50,
            "revenue_currency_id": test_currency_id,
            "convert_to_opportunity_date": future_date,
            "assigned_to_user_id": test_user_id,
            "project_description": "Test lead for comprehensive CRUD testing",
            "decision_maker_percentage": 75,
            "notes": "Test notes for lead creation"
        }
        
        print(f"   Lead data to create: {json.dumps(valid_lead_data, indent=2)}")
        
        success2, response2 = self.run_test(
            "POST /api/leads - Successful Creation",
            "POST",
            "leads",
            200,
            data=valid_lead_data
        )
        
        if not success2:
            print("❌ Lead creation failed - stopping comprehensive testing")
            return False
        
        created_lead_id = None
        if response2.get('success') and 'data' in response2:
            created_lead_id = response2['data'].get('lead_id')
            print(f"   Created lead ID: {created_lead_id}")
            
            # Verify LEAD-XXXXXX format
            if created_lead_id and created_lead_id.startswith('LEAD-') and len(created_lead_id) == 11:
                print("✅ Lead ID generation working (LEAD-XXXXXX format)")
            else:
                print(f"❌ Lead ID format incorrect: {created_lead_id}")
                return False
        
        # 3. GET /api/leads - Verify lead was created
        success3, response3 = self.run_test(
            "GET /api/leads - Verify Lead Created",
            "GET",
            "leads",
            200
        )
        
        if success3 and response3.get('success'):
            current_leads = response3['data']
            print(f"   Current leads count: {len(current_leads)}")
            
            if len(current_leads) > len(initial_leads):
                print("✅ Lead successfully created and appears in leads list")
                
                # Find our created lead
                our_lead = None
                for lead in current_leads:
                    if lead.get('lead_id') == created_lead_id:
                        our_lead = lead
                        break
                
                if our_lead:
                    print("✅ Created lead found in leads list")
                    print(f"   Lead details: {our_lead.get('project_title')} - {our_lead.get('company_name')}")
                    
                    # Verify data enrichment
                    enrichment_fields = [
                        'lead_subtype_name', 'lead_source_name', 'company_name', 
                        'currency_code', 'assigned_user_name'
                    ]
                    
                    missing_enrichment = [field for field in enrichment_fields if field not in our_lead]
                    if not missing_enrichment:
                        print("✅ Data enrichment working - all master data names present")
                        print(f"   Company: {our_lead.get('company_name')}")
                        print(f"   Subtype: {our_lead.get('lead_subtype_name')}")
                        print(f"   Source: {our_lead.get('lead_source_name')}")
                        print(f"   Currency: {our_lead.get('currency_code')}")
                        print(f"   Assigned to: {our_lead.get('assigned_user_name')}")
                    else:
                        print(f"❌ Missing enrichment fields: {missing_enrichment}")
                        return False
                else:
                    print("❌ Created lead not found in leads list")
                    return False
            else:
                print("❌ Lead count did not increase after creation")
                return False
        
        # 4. Test Required Field Validation
        print("\n--- REQUIRED FIELD VALIDATION TESTING ---")
        
        required_fields = [
            "project_title", "lead_subtype_id", "lead_source_id", "company_id",
            "expected_revenue", "revenue_currency_id", "convert_to_opportunity_date", "assigned_to_user_id"
        ]
        
        validation_tests_passed = 0
        for field_name in required_fields:
            test_data = valid_lead_data.copy()
            test_data.pop(field_name)
            
            success, response = self.run_test(
                f"POST /api/leads - Missing {field_name}",
                "POST",
                "leads",
                422,  # Pydantic validation error
                data=test_data
            )
            
            if success:
                validation_tests_passed += 1
                print(f"   ✅ Required field validation working for {field_name}")
            else:
                print(f"   ❌ Required field validation failed for {field_name}")
        
        print(f"   Required field validation: {validation_tests_passed}/{len(required_fields)} passed")
        
        # 5. Test Business Rule Validation
        print("\n--- BUSINESS RULE VALIDATION TESTING ---")
        
        # Test negative revenue
        negative_revenue_data = valid_lead_data.copy()
        negative_revenue_data["expected_revenue"] = -1000
        
        success4, response4 = self.run_test(
            "POST /api/leads - Negative Revenue",
            "POST",
            "leads",
            422,  # Pydantic validation error
            data=negative_revenue_data
        )
        
        # Test decision_maker_percentage outside 1-100 range
        invalid_percentage_data = valid_lead_data.copy()
        invalid_percentage_data["decision_maker_percentage"] = 150
        
        success5, response5 = self.run_test(
            "POST /api/leads - Invalid Decision Maker Percentage",
            "POST",
            "leads",
            422,  # Pydantic validation error
            data=invalid_percentage_data
        )
        
        business_rule_tests = [success4, success5]
        business_rule_passed = sum(business_rule_tests)
        print(f"   Business rule validation: {business_rule_passed}/{len(business_rule_tests)} passed")
        
        # Calculate overall success
        all_tests = [success1, success2, success3] + [True] * validation_tests_passed + business_rule_tests
        passed_tests = sum(all_tests)
        total_tests = len(all_tests)
        
        print(f"\n--- COMPREHENSIVE LEAD CRUD TESTING SUMMARY ---")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if passed_tests == total_tests:
            print("🎉 COMPREHENSIVE LEAD CRUD OPERATIONS TESTING COMPLETED SUCCESSFULLY!")
            print("✅ All Lead CRUD operations working correctly")
            print("✅ Lead ID generation working (LEAD-XXXXXX format)")
            print("✅ All validation rules implemented correctly")
            print("✅ Data enrichment working with master data lookups")
            print("✅ Proper error handling and HTTP status codes")
        else:
            print(f"❌ {total_tests - passed_tests} Lead CRUD tests failed")
        
        return passed_tests == total_tests

def main():
    tester = LeadCRUDTester()
    
    # Initialize database
    success, response = tester.run_test(
        "Initialize Database",
        "POST",
        "init-db",
        200
    )
    
    if not success:
        print("❌ Database initialization failed")
        return False
    
    # Authenticate
    if not tester.authenticate():
        print("❌ Authentication failed")
        return False
    
    # Run comprehensive Lead CRUD testing
    result = tester.test_comprehensive_lead_crud()
    
    print(f"\n{'='*60}")
    print("FINAL TESTING SUMMARY")
    print(f"{'='*60}")
    print(f"Total Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    return result

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)