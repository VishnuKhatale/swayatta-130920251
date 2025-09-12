from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import os
import logging
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any
import uuid
from bson import ObjectId
import functools
import aiofiles
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="ERP User Management System")

# Create uploads directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserBase(BaseModel):
    name: str  # Keeping for backward compatibility
    full_name: Optional[str] = None
    username: Optional[str] = None
    email: EmailStr
    contact_no: Optional[str] = None
    gender: Optional[str] = None  # Male, Female, Other
    dob: Optional[datetime] = None
    profile_photo: Optional[str] = None
    role_id: str
    department_id: Optional[str] = None
    sub_department_id: Optional[str] = None
    designation: Optional[str] = None
    is_reporting: bool = False
    reporting_to: Optional[str] = None  # FK to users.id
    region: Optional[str] = None  # North, South, East, West
    address: Optional[str] = None
    business_verticals: Optional[List[str]] = []

    @validator('username')
    def validate_username(cls, v):
        if v and ' ' in v:
            raise ValueError('Username cannot contain spaces')
        return v
    
    @validator('contact_no')
    def validate_contact_no(cls, v):
        if v and not re.match(r'^\d{1,15}$', v):
            raise ValueError('Contact number must be numeric and max 15 digits')
        return v
    
    @validator('gender')
    def validate_gender(cls, v):
        if v and v not in ['Male', 'Female', 'Other']:
            raise ValueError('Gender must be Male, Female, or Other')
        return v
    
    @validator('region')
    def validate_region(cls, v):
        if v and v not in ['North', 'South', 'East', 'West']:
            raise ValueError('Region must be North, South, East, or West')
        return v
    
    @validator('dob')
    def validate_dob(cls, v):
        if v:
            # Ensure both datetimes are timezone-aware for comparison
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            if v >= datetime.now(timezone.utc):
                raise ValueError('Date of birth must be in the past')
        return v
    
    @validator('full_name')
    def validate_full_name(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9\s]+$', v):
            raise ValueError('Full name must contain only alphanumeric characters and spaces')
        return v

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_no: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[datetime] = None
    profile_photo: Optional[str] = None
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    sub_department_id: Optional[str] = None
    designation: Optional[str] = None
    is_reporting: Optional[bool] = None
    reporting_to: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    business_verticals: Optional[List[str]] = None
    password: Optional[str] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

# Business Verticals Master Model
class BusinessVertical(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class Role(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class Permission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None

class Menu(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    path: str
    parent_id: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class Department(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class RolePermission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role_id: str
    menu_id: str
    permission_ids: List[str]
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# ===== SALES MODULE MODELS =====

# 1️⃣ Master Tables
class JobFunctionMaster(BaseModel):
    job_function_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_function_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class PartnerTypeMaster(BaseModel):
    partner_type_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    partner_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class CompanyTypeMaster(BaseModel):
    company_type_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class HeadOfCompanyMaster(BaseModel):
    head_of_company_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    head_role_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class ProductServiceInterest(BaseModel):
    product_service_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_service_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterAccountTypes(BaseModel):
    account_type_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterAccountRegions(BaseModel):
    region_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    region_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterBusinessTypes(BaseModel):
    business_type_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterIndustrySegments(BaseModel):
    industry_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    industry_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterSubIndustrySegments(BaseModel):
    sub_industry_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    industry_id: str  # FK to master_industry_segments
    sub_industry_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterAddressTypes(BaseModel):
    address_type_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterCountries(BaseModel):
    country_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    country_name: str
    country_code: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterStates(BaseModel):
    state_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    country_id: str  # FK to master_countries
    state_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterCities(BaseModel):
    city_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    state_id: str  # FK to master_states
    city_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterDocumentTypes(BaseModel):
    document_type_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class MasterCurrencies(BaseModel):
    currency_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    currency_code: str
    currency_name: str
    symbol: str
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class ExchangeRate(BaseModel):
    exchange_rate_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    currency_code: str
    base_currency: str = "INR"  # Default base currency
    rate: float
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

# 2️⃣ Transactional Tables (Sales Module)
class Partner(BaseModel):
    partner_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Partner Information
    first_name: str
    last_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    job_function_id: str  # FK to job_function_master
    # Company Information
    company_name: str
    company_type_id: str  # FK to company_type_master
    partner_type_id: str  # FK to partner_type_master
    head_of_company_id: str  # FK to head_of_company_master
    gst_no: Optional[str] = Field(None, max_length=15)
    pan_no: Optional[str] = Field(None, max_length=10)
    # System fields
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class Company(BaseModel):
    company_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_name: str
    company_type_id: str  # FK to company_type_master
    partner_type_id: str  # FK to partner_type_master
    head_of_company_id: str  # FK to head_of_company_master
    gst_no: Optional[str] = None
    pan_no: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class CompanyAddress(BaseModel):
    address_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str  # FK to companies
    address_type_id: str  # FK to master_address_types
    address: str
    country_id: str  # FK to master_countries
    state_id: str  # FK to master_states
    city_id: str  # FK to master_cities
    zipcode: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class CompanyDocument(BaseModel):
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str  # FK to companies
    document_type_id: str  # FK to master_document_types
    file_path: str
    description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class CompanyFinancial(BaseModel):
    financial_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str  # FK to companies
    year: int
    revenue: Optional[float] = None
    profit: Optional[float] = None
    currency_id: str  # FK to master_currencies
    type: str  # e.g., "Annual", "Quarterly"
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class Contact(BaseModel):
    contact_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str  # FK to companies
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    mobile: Optional[str] = None
    designation_id: Optional[str] = None  # FK to job_function_master
    department: Optional[str] = None
    is_primary: bool = False
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class LoginLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    login_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# ===== QUOTATION MANAGEMENT SYSTEM (QMS) MASTER TABLES =====

class Quotation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_number: str
    opportunity_id: str
    customer_id: str
    customer_name: str
    customer_contact_email: Optional[str] = None
    customer_contact_phone: Optional[str] = None
    pricing_list_id: str
    currency_id: str = "1"
    validity_date: str  # Date in YYYY-MM-DD format
    quotation_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    status: str = "Draft"  # Draft, Unapproved, Approved
    overall_discount_type: Optional[str] = None  # percentage, absolute
    overall_discount_value: float = 0.0
    discount_reason: Optional[str] = None
    total_otp: float = 0.0
    total_year1: float = 0.0
    total_year2: float = 0.0
    total_year3: float = 0.0
    total_year4: float = 0.0
    total_year5: float = 0.0
    total_year6: float = 0.0
    total_year7: float = 0.0
    total_year8: float = 0.0
    total_year9: float = 0.0
    total_year10: float = 0.0
    grand_total: float = 0.0
    terms_and_conditions: Optional[str] = None
    internal_notes: Optional[str] = None
    external_notes: Optional[str] = None
    is_active: bool = True
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    # Additional audit fields for tracking actions
    deleted_by: Optional[str] = None
    deleted_at: Optional[datetime] = None
    delete_reason: Optional[str] = None

class QuotationPhase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_id: str
    phase_name: str
    phase_description: Optional[str] = None
    phase_order: int
    phase_total_otp: float = 0.0
    phase_total_year1: float = 0.0
    phase_total_year2: float = 0.0
    phase_total_year3: float = 0.0
    phase_total_year4: float = 0.0
    phase_total_year5: float = 0.0
    phase_total_year6: float = 0.0
    phase_total_year7: float = 0.0
    phase_total_year8: float = 0.0
    phase_total_year9: float = 0.0
    phase_total_year10: float = 0.0
    phase_grand_total: float = 0.0
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class QuotationGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phase_id: str
    group_name: str
    group_description: Optional[str] = None
    group_order: int
    discount_type: Optional[str] = None  # percentage, absolute
    discount_value: float = 0.0
    discount_reason: Optional[str] = None
    group_total_otp: float = 0.0
    group_total_year1: float = 0.0
    group_total_year2: float = 0.0
    group_total_year3: float = 0.0
    group_total_year4: float = 0.0
    group_total_year5: float = 0.0
    group_total_year6: float = 0.0
    group_total_year7: float = 0.0
    group_total_year8: float = 0.0
    group_total_year9: float = 0.0
    group_total_year10: float = 0.0
    group_grand_total: float = 0.0
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class QuotationItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    core_product_id: str
    pricing_model_id: str
    product_name: Optional[str] = None
    product_description: Optional[str] = None
    sku_code: Optional[str] = None
    quantity: float = 1.0
    unit_of_measure: str = "Each"
    base_otp: float = 0.0
    base_recurring: float = 0.0
    discount_type: Optional[str] = None  # percentage, absolute
    discount_value: float = 0.0
    discount_reason: Optional[str] = None
    net_otp: float = 0.0
    net_recurring: float = 0.0
    service_start_date: Optional[str] = None
    service_end_date: Optional[str] = None
    contract_duration_months: int = 12
    line_total_otp: float = 0.0
    line_total_recurring: float = 0.0
    item_order: int
    custom_notes: Optional[str] = None
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class QuotationItemYearly(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    year_no: int  # 1-10
    allocated_otp: float = 0.0
    allocated_recurring: float = 0.0
    year_total: float = 0.0
    year_start_date: Optional[str] = None
    year_end_date: Optional[str] = None
    proration_factor: float = 1.0
    base_year_price: float = 0.0
    currency_id: str = "1"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuotationVersion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_id: str
    version_number: int
    version_name: Optional[str] = None
    snapshot_data: str  # JSON string
    change_summary: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuotationAuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_id: str
    table_name: str
    record_id: str
    action: str  # create, update, delete, submit, approve, reject, send
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    user_id: str
    user_role: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApprovalWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_name: str
    quotation_value_min: float = 0.0
    quotation_value_max: float = 999999999.0
    required_approvers: int = 1
    approval_sequence: str = "sequential"  # parallel, sequential
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApprovalStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    step_name: str
    step_order: int
    approver_role: Optional[str] = None
    approver_user_id: Optional[str] = None
    is_required: bool = True
    min_discount_percentage: float = 0.0
    min_quotation_value: float = 0.0
    requires_justification: bool = False

class QuotationApproval(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_id: str
    step_id: str
    approver_id: str
    status: str = "pending"  # pending, approved, rejected, delegated
    approval_date: Optional[datetime] = None
    comments: Optional[str] = None
    justification: Optional[str] = None
    delegated_to: Optional[str] = None
    delegated_reason: Optional[str] = None

class QuotationAttachment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_id: str
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    attachment_type: str = "other"  # technical_spec, terms_conditions, supporting_doc, other
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class DiscountRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rule_name: str
    rule_description: Optional[str] = None
    min_quantity: float = 0.0
    max_quantity: Optional[float] = None
    min_value: float = 0.0
    max_value: Optional[float] = None
    applicable_categories: Optional[str] = None  # JSON string
    applicable_products: Optional[str] = None  # JSON string
    customer_segments: Optional[str] = None  # JSON string
    discount_type: str  # percentage, absolute, tiered
    discount_value: float
    max_discount_amount: Optional[float] = None
    priority_order: int = 100
    stackable: bool = False
    requires_approval: bool = False
    approval_threshold: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class ExportTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_name: str
    template_type: str  # pdf, excel, word
    template_path: Optional[str] = None
    is_default: bool = False
    company_branding: Optional[str] = None  # JSON string
    include_cover_page: bool = True
    include_terms: bool = True
    include_yearly_breakdown: bool = True
    include_category_grouping: bool = False
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class CustomerQuotationAccess(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_id: str
    access_token: str
    customer_email: str
    can_view_pricing: bool = True
    can_download_pdf: bool = True
    can_provide_feedback: bool = True
    expires_at: datetime
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_revoked: bool = False

# ===== PRODUCT & PRICING MASTER TABLES =====

class CoreProductModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    core_product_name: str
    skucode: str
    primary_category: str
    secondary_category: Optional[str] = None
    tertiary_category: Optional[str] = None
    fourth_category: Optional[str] = None
    fifth_category: Optional[str] = None
    product_description: Optional[str] = None
    unit_of_measure: str = "Each"
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class PricingModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    core_product_id: str
    pricing_model_name: str
    pricing_list_id: str = "default"  # Link to pricing list
    selling_price: float = 0.0
    selling_price_y2: float = 0.0
    selling_price_y3: float = 0.0
    selling_price_y4: float = 0.0
    selling_price_y5: float = 0.0
    selling_price_y6: float = 0.0
    selling_price_y7: float = 0.0
    selling_price_y8: float = 0.0
    selling_price_y9: float = 0.0
    selling_price_y10: float = 0.0
    recurring_selling_price: float = 0.0
    currency_id: str = "1"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class PricingList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    currency_id: str = "1"
    is_default: bool = False
    effective_date: str
    expiry_date: Optional[str] = None
    markup_percentage: float = 0.0
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

# ===== END PRODUCT & PRICING MASTER TABLES =====

# ===== SERVICE DELIVERY (SD) MODULE MODELS =====

class ServiceDeliveryRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sd_request_id: str = Field(default_factory=lambda: f"SDR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}")
    opportunity_id: str  # FK to opportunities
    project_status: str = "Upcoming"  # Upcoming, Project, Completed, Rejected
    approval_status: str = "Pending"  # Pending, Approved, Rejected, Review
    delivery_status: str = "Pending"  # Pending, In-Progress, Partial, Completed
    delivery_progress: float = 0.0  # Percentage (0-100)
    expected_delivery_date: Optional[str] = None  # YYYY-MM-DD format
    actual_delivery_date: Optional[str] = None  # YYYY-MM-DD format
    project_value: Optional[float] = None
    client_name: Optional[str] = None
    sales_owner_id: Optional[str] = None  # FK to users
    delivery_owner_id: Optional[str] = None  # FK to users
    remarks: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modified_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    is_deleted: bool = False

class ServiceDeliveryApproval(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    approval_id: str = Field(default_factory=lambda: f"APP-{str(uuid.uuid4())[:8].upper()}")
    sd_request_id: str  # FK to service_delivery_requests
    approver_id: str  # FK to users
    approver_role: str  # Manager, Delivery Head, Admin
    approval_status: str = "Pending"  # Pending, Approved, Rejected, Review
    remarks: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    resubmission_count: int = 0
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    is_deleted: bool = False

class ServiceDeliveryLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    log_id: str = Field(default_factory=lambda: f"LOG-{str(uuid.uuid4())[:8].upper()}")
    sd_request_id: Optional[str] = None  # FK to service_delivery_requests
    opportunity_id: str  # FK to opportunities
    action_type: str  # Creation, Review, Approval, Rejection, Resubmission, ERP_Sync, Progress_Update
    action_status: str = "Success"  # Success, Failed, Warning
    action_description: str
    user_id: str  # FK to users
    user_role: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    error_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None
    is_active: bool = True

class ServiceDeliveryMilestone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sd_request_id: str  # FK to service_delivery_requests
    milestone_name: str
    milestone_description: Optional[str] = None
    planned_date: Optional[str] = None  # YYYY-MM-DD format
    actual_date: Optional[str] = None  # YYYY-MM-DD format
    status: str = "Pending"  # Pending, In-Progress, Completed, Delayed
    progress_percentage: float = 0.0
    deliverables: Optional[str] = None  # JSON string of deliverables
    milestone_order: int = 1
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    is_deleted: bool = False

class ServiceDeliveryDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sd_request_id: str  # FK to service_delivery_requests
    document_name: str
    document_type: str  # Contract, SOW, Technical_Spec, Delivery_Plan, Report, Other
    file_path: str
    file_size: Optional[int] = None
    uploaded_by: str  # FK to users
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    document_status: str = "Active"  # Active, Archived, Superseded
    version: str = "1.0"
    is_active: bool = True
    is_deleted: bool = False

class ServiceDeliveryERPSync(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sd_request_id: str  # FK to service_delivery_requests
    erp_project_id: Optional[str] = None
    erp_sync_status: str = "Pending"  # Pending, Synced, Failed, Manual
    last_sync_date: Optional[datetime] = None
    sync_data: Optional[str] = None  # JSON string of ERP data
    sync_error: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

# ===== END SERVICE DELIVERY MODULE MODELS =====

# ===== END QMS MASTER TABLES =====

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id, "is_deleted": False})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def log_activity(activity: ActivityLog):
    """Helper function to log user activities"""
    await db.activity_logs.insert_one(activity.dict())

# Permission checking utilities
async def get_user_permissions(user_id: str, menu_path: str = None) -> Dict[str, List[str]]:
    """Get user's permissions, optionally filtered by menu path"""
    # Get user to find their role
    user = await db.users.find_one({"id": user_id, "is_deleted": False})
    if not user:
        return {}
    
    # Get role permissions
    query = {"role_id": user["role_id"], "is_deleted": False}
    if menu_path:
        # Find menu by path
        menu = await db.menus.find_one({"path": menu_path, "is_deleted": False})
        if menu:
            query["menu_id"] = menu["id"]
    
    role_permissions = await db.role_permissions.find(query).to_list(1000)
    
    # Group permissions by menu path
    permissions_by_menu = {}
    for rp in role_permissions:
        menu = await db.menus.find_one({"id": rp["menu_id"], "is_deleted": False})
        if menu:
            menu_path = menu["path"]
            if menu_path not in permissions_by_menu:
                permissions_by_menu[menu_path] = []
            
            # Get permission names
            for perm_id in rp["permission_ids"]:
                permission = await db.permissions.find_one({"id": perm_id})
                if permission:
                    permissions_by_menu[menu_path].append(permission["name"])
    
    return permissions_by_menu

async def check_permission(user: User, menu_path: str, permission_name: str) -> bool:
    """Check if user has specific permission for a menu"""
    # Get user's role to check if they're an admin
    user_doc = await db.users.find_one({"id": user.id, "is_deleted": False})
    if user_doc:
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        if role and role["name"].lower() == "admin":
            # Admin role bypasses all permission checks
            return True
    
    # For non-admin users, check permissions normally
    user_permissions = await get_user_permissions(user.id, menu_path)
    menu_permissions = user_permissions.get(menu_path, [])
    return permission_name in menu_permissions

def require_permission(menu_path: str, permission_name: str):
    """Decorator to check if user has required permission"""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from function arguments
            current_user = None
            for arg in args:
                if isinstance(arg, User):
                    current_user = arg
                    break
            
            # Check in kwargs as well
            if not current_user:
                current_user = kwargs.get('current_user')
            
            if not current_user:
                raise HTTPException(status_code=403, detail="Authentication required")
            
            # Check permission
            has_permission = await check_permission(current_user, menu_path, permission_name)
            if not has_permission:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Insufficient permissions. Required: {permission_name} access to {menu_path}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Authentication endpoints
@api_router.post("/auth/register", response_model=APIResponse)
async def register(user: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email, "is_deleted": False})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Check if role exists
    role = await db.roles.find_one({"id": user.role_id, "is_deleted": False})
    if not role:
        raise HTTPException(status_code=400, detail="Role not found")
    
    # Hash password and create user
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict.pop("password")
    
    new_user = User(**user_dict)
    user_data = new_user.dict()
    user_data["password"] = hashed_password
    
    await db.users.insert_one(user_data)
    return APIResponse(success=True, message="User registered successfully", data={"user_id": new_user.id})

@api_router.post("/auth/login", response_model=APIResponse)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email, "is_deleted": False})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is inactive")
    
    # Create tokens
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user["id"]})
    
    # Log the login
    login_log = LoginLog(user_id=user["id"])
    await db.login_logs.insert_one(login_log.dict())
    
    return APIResponse(
        success=True, 
        message="Login successful",
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role_id": user["role_id"]
            }
        }
    )

@api_router.get("/auth/me", response_model=APIResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    # Get user's role name
    user_data = current_user.dict()
    role = await db.roles.find_one({"id": current_user.role_id, "is_deleted": False})
    if role:
        user_data["role_name"] = role["name"]
    else:
        user_data["role_name"] = "Unknown"
    
    return APIResponse(success=True, message="User info retrieved", data=user_data)

@api_router.get("/auth/permissions", response_model=APIResponse)
async def get_current_user_permissions(current_user: User = Depends(get_current_user)):
    """Get current user's permissions for all menus"""
    permissions = await get_user_permissions(current_user.id)
    return APIResponse(success=True, message="User permissions retrieved", data=permissions)

# User management endpoints
@api_router.get("/users", response_model=APIResponse)
@require_permission("/users", "view")
async def get_users(current_user: User = Depends(get_current_user)):
    users = await db.users.find({"is_deleted": False}).to_list(1000)
    users_data = []
    for user in users:
        user_data = User(**user).dict()
        user_data.pop("password", None)  # Don't send password
        
        # Get role name
        role = await db.roles.find_one({"id": user["role_id"], "is_deleted": False})
        user_data["role_name"] = role["name"] if role else "Unknown"
        
        # Get department name
        if user.get("department_id"):
            dept = await db.departments.find_one({"id": user["department_id"], "is_deleted": False})
            user_data["department_name"] = dept["name"] if dept else "Unknown"
        else:
            user_data["department_name"] = "Not assigned"
        
        # Get sub-department name
        if user.get("sub_department_id"):
            sub_dept = await db.sub_departments.find_one({"id": user["sub_department_id"], "is_deleted": False})
            user_data["sub_department_name"] = sub_dept["name"] if sub_dept else "Unknown"
        else:
            user_data["sub_department_name"] = "Not assigned"
        
        # Get reporting to user name
        if user.get("reporting_to"):
            reporting_user = await db.users.find_one({"id": user["reporting_to"], "is_deleted": False})
            user_data["reporting_to_name"] = reporting_user["name"] if reporting_user else "Unknown"
        else:
            user_data["reporting_to_name"] = "None"
            
        users_data.append(user_data)
    
    return APIResponse(success=True, message="Users retrieved", data=users_data)

@api_router.post("/users", response_model=APIResponse)
@require_permission("/users", "create")
async def create_user(user: UserCreate, current_user: User = Depends(get_current_user)):
    try:
        # Validate email uniqueness
        existing_email = await db.users.find_one({"email": user.email, "is_deleted": False})
        if existing_email:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Validate username uniqueness (if provided)
        if user.username:
            existing_username = await db.users.find_one({"username": user.username, "is_deleted": False})
            if existing_username:
                raise HTTPException(status_code=400, detail="User with this username already exists")
        
        # Check if role exists
        role = await db.roles.find_one({"id": user.role_id, "is_deleted": False})
        if not role:
            raise HTTPException(status_code=400, detail="Role not found")
        
        # Check if department exists (if provided)
        if user.department_id:
            dept = await db.departments.find_one({"id": user.department_id, "is_deleted": False})
            if not dept:
                raise HTTPException(status_code=400, detail="Department not found")
        
        # Check if sub-department exists and belongs to the department (if provided)
        if user.sub_department_id:
            if not user.department_id:
                raise HTTPException(status_code=400, detail="Department is required when sub-department is selected")
            sub_dept = await db.sub_departments.find_one({
                "id": user.sub_department_id, 
                "department_id": user.department_id,
                "is_deleted": False
            })
            if not sub_dept:
                raise HTTPException(status_code=400, detail="Sub-department not found or doesn't belong to selected department")
        
        # Check if reporting_to user exists (if provided)
        if user.reporting_to:
            reporting_user = await db.users.find_one({"id": user.reporting_to, "is_deleted": False, "is_active": True})
            if not reporting_user:
                raise HTTPException(status_code=400, detail="Reporting to user not found or inactive")
        
        # Validate business verticals (if provided)
        if user.business_verticals:
            for vertical_id in user.business_verticals:
                vertical = await db.business_verticals.find_one({"id": vertical_id, "is_deleted": False})
                if not vertical:
                    raise HTTPException(status_code=400, detail=f"Business vertical {vertical_id} not found")
        
        # Hash password and create user
        hashed_password = get_password_hash(user.password)
        user_dict = user.dict()
        user_dict.pop("password")
        
        # Set defaults for backward compatibility
        if not user_dict.get("full_name"):
            user_dict["full_name"] = user_dict["name"]  # Use name as full_name if not provided
        if not user_dict.get("business_verticals"):
            user_dict["business_verticals"] = []
        
        new_user = User(**user_dict)
        new_user.created_by = current_user.id
        new_user.updated_by = current_user.id
        
        user_data = new_user.dict()
        user_data["password"] = hashed_password
        
        await db.users.insert_one(user_data)
        
        # Log activity
        activity_log = ActivityLog(user_id=current_user.id, action=f"Created user: {new_user.name}")
        await db.activity_logs.insert_one(activity_log.dict())
        
        return APIResponse(success=True, message="User created successfully", data={"user_id": new_user.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

# Get active users for reporting dropdown (MUST be before /users/{user_id})
@api_router.get("/users/active", response_model=APIResponse)
async def get_active_users(current_user: User = Depends(get_current_user)):
    try:
        users = await db.users.find({"is_deleted": False, "is_active": True}).to_list(1000)
        users_data = []
        for user in users:
            users_data.append({
                "id": user["id"],
                "name": user["name"],
                "full_name": user.get("full_name", user["name"]),
                "email": user["email"],
                "designation": user.get("designation", "")
            })
        
        return APIResponse(success=True, message="Active users retrieved", data=users_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active users: {str(e)}")

@api_router.get("/users/{user_id}", response_model=APIResponse)
@require_permission("/users", "view")
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id, "is_deleted": False})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = User(**user).dict()
    user_data.pop("password", None)  # Don't send password
    
    return APIResponse(success=True, message="User retrieved", data=user_data)

@api_router.put("/users/{user_id}", response_model=APIResponse)
@require_permission("/users", "edit")
async def update_user(user_id: str, user_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing user
    existing_user = await db.users.find_one({"id": user_id, "is_deleted": False})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate required fields
    if user_data.get("name") is not None and not user_data["name"]:
        raise HTTPException(status_code=400, detail="Name is required")
    if user_data.get("email") is not None and not user_data["email"]:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Validate email uniqueness
    if user_data.get("email"):
        email_check = await db.users.find_one({
            "email": user_data["email"], 
            "is_deleted": False,
            "id": {"$ne": user_id}
        })
        if email_check:
            raise HTTPException(status_code=400, detail="Another user with this email already exists")
    
    # Validate username uniqueness (if provided)
    if user_data.get("username"):
        username_check = await db.users.find_one({
            "username": user_data["username"], 
            "is_deleted": False,
            "id": {"$ne": user_id}
        })
        if username_check:
            raise HTTPException(status_code=400, detail="Another user with this username already exists")
    
    # Validate contact number format
    if user_data.get("contact_no") and not re.match(r'^\d{1,15}$', user_data["contact_no"]):
        raise HTTPException(status_code=400, detail="Contact number must be numeric and max 15 digits")
    
    # Validate full name format
    if user_data.get("full_name") and not re.match(r'^[a-zA-Z\s]+$', user_data["full_name"]):
        raise HTTPException(status_code=400, detail="Full name must contain only alphabets and spaces")
    
    # Validate gender
    if user_data.get("gender") and user_data["gender"] not in ['Male', 'Female', 'Other']:
        raise HTTPException(status_code=400, detail="Gender must be Male, Female, or Other")
    
    # Validate region
    if user_data.get("region") and user_data["region"] not in ['North', 'South', 'East', 'West']:
        raise HTTPException(status_code=400, detail="Region must be North, South, East, or West")
    
    # Validate DOB (must be past date)
    if user_data.get("dob"):
        try:
            dob = datetime.fromisoformat(user_data["dob"].replace('Z', '+00:00')) if isinstance(user_data["dob"], str) else user_data["dob"]
            if dob >= datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Date of birth must be in the past")
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid date format for date of birth")
    
    # Validate role exists
    if user_data.get("role_id"):
        role = await db.roles.find_one({"id": user_data["role_id"], "is_deleted": False})
        if not role:
            raise HTTPException(status_code=400, detail="Role not found")
    
    # Validate department exists (if provided)
    if user_data.get("department_id"):
        dept = await db.departments.find_one({"id": user_data["department_id"], "is_deleted": False})
        if not dept:
            raise HTTPException(status_code=400, detail="Department not found")
    
    # Validate sub-department exists and belongs to department
    if user_data.get("sub_department_id"):
        dept_id = user_data.get("department_id") or existing_user.get("department_id")
        if not dept_id:
            raise HTTPException(status_code=400, detail="Department is required when sub-department is selected")
        sub_dept = await db.sub_departments.find_one({
            "id": user_data["sub_department_id"], 
            "department_id": dept_id,
            "is_deleted": False
        })
        if not sub_dept:
            raise HTTPException(status_code=400, detail="Sub-department not found or doesn't belong to selected department")
    
    # Validate reporting_to user exists
    if user_data.get("reporting_to"):
        if user_data["reporting_to"] == user_id:
            raise HTTPException(status_code=400, detail="User cannot report to themselves")
        reporting_user = await db.users.find_one({"id": user_data["reporting_to"], "is_deleted": False, "is_active": True})
        if not reporting_user:
            raise HTTPException(status_code=400, detail="Reporting to user not found or inactive")
    
    # Validate business verticals
    if user_data.get("business_verticals"):
        for vertical_id in user_data["business_verticals"]:
            vertical = await db.business_verticals.find_one({"id": vertical_id, "is_deleted": False})
            if not vertical:
                raise HTTPException(status_code=400, detail=f"Business vertical {vertical_id} not found")
    
    # Prepare update data
    update_data = {
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    # Update fields if provided
    allowed_fields = [
        "name", "full_name", "username", "email", "contact_no", "gender", "dob", 
        "profile_photo", "role_id", "department_id", "sub_department_id", 
        "designation", "is_reporting", "reporting_to", "region", "address", "business_verticals"
    ]
    
    for field in allowed_fields:
        if field in user_data:
            update_data[field] = user_data[field]
    
    # Update password if provided
    if user_data.get("password"):
        update_data["password"] = get_password_hash(user_data["password"])
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Log activity
    user_name = user_data.get("name") or existing_user["name"]
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated user: {user_name}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="User updated successfully")

@api_router.delete("/users/{user_id}", response_model=APIResponse)
@require_permission("/users", "delete")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    # Find existing user
    user = await db.users.find_one({"id": user_id, "is_deleted": False})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Soft delete the user
    update_data = {
        "is_deleted": True,
        "is_active": False,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted user: {user['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="User deleted successfully")

@api_router.patch("/users/{user_id}/toggle-status", response_model=APIResponse)
@require_permission("/users", "edit")
async def toggle_user_status(user_id: str, current_user: User = Depends(get_current_user)):
    # Find existing user
    user = await db.users.find_one({"id": user_id, "is_deleted": False})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self-deactivation
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own account status")
    
    # Toggle status
    new_status = not user["is_active"]
    update_data = {
        "is_active": new_status,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Log activity
    status_text = "activated" if new_status else "deactivated"
    activity_log = ActivityLog(user_id=current_user.id, action=f"User {user['name']} {status_text}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message=f"User {status_text} successfully")

# Business Verticals Management endpoints (Fix missing endpoint)
@api_router.get("/master/business-verticals", response_model=APIResponse)
async def get_master_business_verticals(current_user: User = Depends(get_current_user)):
    try:
        verticals = await db.business_verticals.find({"is_deleted": False}).to_list(1000)
        verticals_data = []
        for vertical in verticals:
            verticals_data.append({
                "id": vertical["id"],
                "name": vertical["name"],
                "is_active": vertical.get("is_active", True),
                "created_at": vertical.get("created_at"),
                "updated_at": vertical.get("updated_at")
            })
        return APIResponse(success=True, message="Business verticals retrieved", data=verticals_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch business verticals: {str(e)}")

# Permission management endpoints
@api_router.get("/permissions", response_model=APIResponse)
async def get_permissions(current_user: User = Depends(get_current_user)):
    permissions = await db.permissions.find({}).to_list(1000)
    permissions_data = [Permission(**perm).dict() for perm in permissions]
    return APIResponse(success=True, message="Permissions retrieved", data=permissions_data)

@api_router.post("/permissions", response_model=APIResponse)
async def create_permission(permission_data: dict, current_user: User = Depends(get_current_user)):
    # Validate required fields
    if not permission_data.get("name"):
        raise HTTPException(status_code=400, detail="Permission name is required")
    
    # Check if permission already exists
    existing_perm = await db.permissions.find_one({"name": permission_data["name"]})
    if existing_perm:
        raise HTTPException(status_code=400, detail="Permission with this name already exists")
    
    permission = Permission(
        name=permission_data["name"],
        description=permission_data.get("description", "")
    )
    
    await db.permissions.insert_one(permission.dict())
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Created permission: {permission.name}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Permission created successfully", data={"permission_id": permission.id})

@api_router.get("/permissions/{permission_id}", response_model=APIResponse)
async def get_permission(permission_id: str, current_user: User = Depends(get_current_user)):
    permission = await db.permissions.find_one({"id": permission_id})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    permission_data = Permission(**permission).dict()
    return APIResponse(success=True, message="Permission retrieved", data=permission_data)

@api_router.put("/permissions/{permission_id}", response_model=APIResponse)
async def update_permission(permission_id: str, permission_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing permission
    existing_perm = await db.permissions.find_one({"id": permission_id})
    if not existing_perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Validate required fields
    if not permission_data.get("name"):
        raise HTTPException(status_code=400, detail="Permission name is required")
    
    # Check if another permission has the same name
    name_check = await db.permissions.find_one({
        "name": permission_data["name"],
        "id": {"$ne": permission_id}
    })
    if name_check:
        raise HTTPException(status_code=400, detail="Another permission with this name already exists")
    
    # Update permission
    update_data = {
        "name": permission_data["name"],
        "description": permission_data.get("description", existing_perm.get("description", ""))
    }
    
    await db.permissions.update_one({"id": permission_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated permission: {permission_data['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Permission updated successfully")

@api_router.delete("/permissions/{permission_id}", response_model=APIResponse)
async def delete_permission(permission_id: str, current_user: User = Depends(get_current_user)):
    # Find existing permission
    permission = await db.permissions.find_one({"id": permission_id})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Check if any role-permission mappings exist for this permission
    role_perms = await db.role_permissions.find_one({"permission_ids": permission_id, "is_deleted": False})
    if role_perms:
        raise HTTPException(status_code=400, detail="Cannot delete permission. It is assigned to roles.")
    
    # Delete the permission (hard delete for permissions as they're system-level)
    await db.permissions.delete_one({"id": permission_id})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted permission: {permission['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Permission deleted successfully")

# Menu management endpoints
@api_router.get("/menus", response_model=APIResponse)
async def get_menus(current_user: User = Depends(get_current_user)):
    menus = await db.menus.find({"is_deleted": False}).to_list(1000)
    menus_data = []
    
    for menu in menus:
        menu_data = Menu(**menu).dict()
        
        # Get parent menu name if exists
        if menu.get("parent_id"):
            parent = await db.menus.find_one({"id": menu["parent_id"], "is_deleted": False})
            menu_data["parent_name"] = parent["name"] if parent else "Unknown"
        else:
            menu_data["parent_name"] = None
            
        # Count child menus
        child_count = await db.menus.count_documents({"parent_id": menu["id"], "is_deleted": False})
        menu_data["child_count"] = child_count
        
        menus_data.append(menu_data)
    
    return APIResponse(success=True, message="Menus retrieved", data=menus_data)

@api_router.post("/menus", response_model=APIResponse)
async def create_menu(menu_data: dict, current_user: User = Depends(get_current_user)):
    # Validate required fields
    if not menu_data.get("name"):
        raise HTTPException(status_code=400, detail="Menu name is required")
    if not menu_data.get("path"):
        raise HTTPException(status_code=400, detail="Menu path is required")
    
    # Check if menu already exists
    existing_menu = await db.menus.find_one({"name": menu_data["name"], "is_deleted": False})
    if existing_menu:
        raise HTTPException(status_code=400, detail="Menu with this name already exists")
    
    # Validate parent menu if provided
    if menu_data.get("parent_id"):
        parent_menu = await db.menus.find_one({"id": menu_data["parent_id"], "is_deleted": False})
        if not parent_menu:
            raise HTTPException(status_code=400, detail="Parent menu not found")
    
    menu = Menu(
        name=menu_data["name"],
        path=menu_data["path"],
        parent_id=menu_data.get("parent_id"),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    await db.menus.insert_one(menu.dict())
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Created menu: {menu.name}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Menu created successfully", data={"menu_id": menu.id})

@api_router.get("/menus/{menu_id}", response_model=APIResponse)
async def get_menu(menu_id: str, current_user: User = Depends(get_current_user)):
    menu = await db.menus.find_one({"id": menu_id, "is_deleted": False})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    menu_data = Menu(**menu).dict()
    
    # Get child menus
    child_menus = await db.menus.find({"parent_id": menu_id, "is_deleted": False}).to_list(100)
    menu_data["child_menus"] = [Menu(**child).dict() for child in child_menus]
    
    return APIResponse(success=True, message="Menu retrieved", data=menu_data)

@api_router.put("/menus/{menu_id}", response_model=APIResponse)
async def update_menu(menu_id: str, menu_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing menu
    existing_menu = await db.menus.find_one({"id": menu_id, "is_deleted": False})
    if not existing_menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Validate required fields
    if not menu_data.get("name"):
        raise HTTPException(status_code=400, detail="Menu name is required")
    if not menu_data.get("path"):
        raise HTTPException(status_code=400, detail="Menu path is required")
    
    # Check if another menu has the same name
    name_check = await db.menus.find_one({
        "name": menu_data["name"], 
        "is_deleted": False,
        "id": {"$ne": menu_id}
    })
    if name_check:
        raise HTTPException(status_code=400, detail="Another menu with this name already exists")
    
    # Validate parent menu if provided
    if menu_data.get("parent_id"):
        # Prevent circular reference
        if menu_data["parent_id"] == menu_id:
            raise HTTPException(status_code=400, detail="Menu cannot be parent of itself")
        
        parent_menu = await db.menus.find_one({"id": menu_data["parent_id"], "is_deleted": False})
        if not parent_menu:
            raise HTTPException(status_code=400, detail="Parent menu not found")
    
    # Update menu
    update_data = {
        "name": menu_data["name"],
        "path": menu_data["path"],
        "parent_id": menu_data.get("parent_id"),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.menus.update_one({"id": menu_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated menu: {menu_data['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Menu updated successfully")

@api_router.delete("/menus/{menu_id}", response_model=APIResponse)
async def delete_menu(menu_id: str, current_user: User = Depends(get_current_user)):
    # Find existing menu
    menu = await db.menus.find_one({"id": menu_id, "is_deleted": False})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Check if any child menus exist
    child_menus = await db.menus.find_one({"parent_id": menu_id, "is_deleted": False})
    if child_menus:
        raise HTTPException(status_code=400, detail="Cannot delete menu. Child menus exist under this menu.")
    
    # Check if any role-permission mappings exist for this menu
    role_perms = await db.role_permissions.find_one({"menu_id": menu_id, "is_deleted": False})
    if role_perms:
        raise HTTPException(status_code=400, detail="Cannot delete menu. It is assigned to roles.")
    
    # Soft delete the menu
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.menus.update_one({"id": menu_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted menu: {menu['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Menu deleted successfully")

# Role management endpoints
@api_router.get("/roles", response_model=APIResponse)
@require_permission("/roles", "view")
async def get_roles(current_user: User = Depends(get_current_user)):
    roles = await db.roles.find({"is_deleted": False}).to_list(1000)
    roles_data = [Role(**role).dict() for role in roles]
    return APIResponse(success=True, message="Roles retrieved", data=roles_data)

@api_router.post("/roles", response_model=APIResponse)
@require_permission("/roles", "create")
async def create_role(role_data: dict, current_user: User = Depends(get_current_user)):
    # Validate required fields
    if not role_data.get("name"):
        raise HTTPException(status_code=400, detail="Role name is required")
    
    # Check if role already exists
    existing_role = await db.roles.find_one({"name": role_data["name"], "is_deleted": False})
    if existing_role:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    role = Role(
        name=role_data["name"],
        description=role_data.get("description", ""),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    await db.roles.insert_one(role.dict())
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Created role: {role.name}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Role created successfully", data={"role_id": role.id})

@api_router.get("/roles/{role_id}", response_model=APIResponse)
@require_permission("/roles", "view")
async def get_role(role_id: str, current_user: User = Depends(get_current_user)):
    role = await db.roles.find_one({"id": role_id, "is_deleted": False})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role_data = Role(**role).dict()
    return APIResponse(success=True, message="Role retrieved", data=role_data)

@api_router.put("/roles/{role_id}", response_model=APIResponse)
@require_permission("/roles", "edit")
async def update_role(role_id: str, role_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing role
    existing_role = await db.roles.find_one({"id": role_id, "is_deleted": False})
    if not existing_role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Validate required fields
    if not role_data.get("name"):
        raise HTTPException(status_code=400, detail="Role name is required")
    
    # Check if another role has the same name
    name_check = await db.roles.find_one({
        "name": role_data["name"], 
        "is_deleted": False,
        "id": {"$ne": role_id}
    })
    if name_check:
        raise HTTPException(status_code=400, detail="Another role with this name already exists")
    
    # Update role
    update_data = {
        "name": role_data["name"],
        "description": role_data.get("description", existing_role.get("description", "")),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated role: {role_data['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Role updated successfully")

@api_router.delete("/roles/{role_id}", response_model=APIResponse)
@require_permission("/roles", "delete")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user)):
    # Find existing role
    role = await db.roles.find_one({"id": role_id, "is_deleted": False})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if any users are assigned to this role
    users_with_role = await db.users.find_one({"role_id": role_id, "is_deleted": False})
    if users_with_role:
        raise HTTPException(status_code=400, detail="Cannot delete role. Users are assigned to this role.")
    
    # Soft delete the role
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted role: {role['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Role deleted successfully")

# Department and Sub-department models
class SubDepartment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    department_id: str  # FK to departments
    description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
# Department management endpoints
@api_router.get("/departments", response_model=APIResponse)
async def get_departments(current_user: User = Depends(get_current_user)):
    departments = await db.departments.find({"is_deleted": False}).to_list(1000)
    departments_data = []
    
    for dept in departments:
        dept_data = Department(**dept).dict()
        # Get sub-departments count
        sub_dept_count = await db.sub_departments.count_documents({"department_id": dept["id"], "is_deleted": False})
        dept_data["sub_departments_count"] = sub_dept_count
        departments_data.append(dept_data)
    
    return APIResponse(success=True, message="Departments retrieved", data=departments_data)

@api_router.post("/departments", response_model=APIResponse)
async def create_department(department_data: dict, current_user: User = Depends(get_current_user)):
    # Validate required fields
    if not department_data.get("name"):
        raise HTTPException(status_code=400, detail="Department name is required")
    
    # Check if department already exists
    existing_dept = await db.departments.find_one({"name": department_data["name"], "is_deleted": False})
    if existing_dept:
        raise HTTPException(status_code=400, detail="Department with this name already exists")
    
    department = Department(
        name=department_data["name"],
        description=department_data.get("description", ""),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    await db.departments.insert_one(department.dict())
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Created department: {department.name}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Department created successfully", data={"department_id": department.id})

@api_router.get("/departments/{department_id}", response_model=APIResponse)
async def get_department(department_id: str, current_user: User = Depends(get_current_user)):
    department = await db.departments.find_one({"id": department_id, "is_deleted": False})
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    dept_data = Department(**department).dict()
    
    # Get sub-departments
    sub_departments = await db.sub_departments.find({"department_id": department_id, "is_deleted": False}).to_list(100)
    dept_data["sub_departments"] = [SubDepartment(**sub_dept).dict() for sub_dept in sub_departments]
    
    return APIResponse(success=True, message="Department retrieved", data=dept_data)

@api_router.put("/departments/{department_id}", response_model=APIResponse)
async def update_department(department_id: str, department_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing department
    existing_dept = await db.departments.find_one({"id": department_id, "is_deleted": False})
    if not existing_dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate required fields
    if not department_data.get("name"):
        raise HTTPException(status_code=400, detail="Department name is required")
    
    # Check if another department has the same name
    name_check = await db.departments.find_one({
        "name": department_data["name"], 
        "is_deleted": False,
        "id": {"$ne": department_id}
    })
    if name_check:
        raise HTTPException(status_code=400, detail="Another department with this name already exists")
    
    # Update department
    update_data = {
        "name": department_data["name"],
        "description": department_data.get("description", existing_dept.get("description", "")),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.departments.update_one({"id": department_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated department: {department_data['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Department updated successfully")

@api_router.delete("/departments/{department_id}", response_model=APIResponse)
async def delete_department(department_id: str, current_user: User = Depends(get_current_user)):
    # Find existing department
    dept = await db.departments.find_one({"id": department_id, "is_deleted": False})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if any users are assigned to this department
    users_in_dept = await db.users.find_one({"department_id": department_id, "is_deleted": False})
    if users_in_dept:
        raise HTTPException(status_code=400, detail="Cannot delete department. Users are assigned to this department.")
    
    # Check if any sub-departments exist
    sub_departments = await db.sub_departments.find_one({"department_id": department_id, "is_deleted": False})
    if sub_departments:
        raise HTTPException(status_code=400, detail="Cannot delete department. Sub-departments exist under this department.")
    
    # Soft delete the department
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.departments.update_one({"id": department_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted department: {dept['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Department deleted successfully")

# Sub-department management endpoints
@api_router.get("/departments/{department_id}/sub-departments", response_model=APIResponse)
async def get_sub_departments(department_id: str, current_user: User = Depends(get_current_user)):
    # Verify department exists
    department = await db.departments.find_one({"id": department_id, "is_deleted": False})
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    sub_departments = await db.sub_departments.find({"department_id": department_id, "is_deleted": False}).to_list(100)
    sub_departments_data = [SubDepartment(**sub_dept).dict() for sub_dept in sub_departments]
    
    return APIResponse(success=True, message="Sub-departments retrieved", data=sub_departments_data)

@api_router.post("/departments/{department_id}/sub-departments", response_model=APIResponse)
async def create_sub_department(department_id: str, sub_dept_data: dict, current_user: User = Depends(get_current_user)):
    # Verify department exists
    department = await db.departments.find_one({"id": department_id, "is_deleted": False})
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate required fields
    if not sub_dept_data.get("name"):
        raise HTTPException(status_code=400, detail="Sub-department name is required")
    
    # Check if sub-department already exists in this department
    existing_sub_dept = await db.sub_departments.find_one({
        "name": sub_dept_data["name"], 
        "department_id": department_id,
        "is_deleted": False
    })
    if existing_sub_dept:
        raise HTTPException(status_code=400, detail="Sub-department with this name already exists in this department")
    
    sub_department = SubDepartment(
        name=sub_dept_data["name"],
        department_id=department_id,
        description=sub_dept_data.get("description", ""),
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    await db.sub_departments.insert_one(sub_department.dict())
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Created sub-department: {sub_department.name} under {department['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Sub-department created successfully", data={"sub_department_id": sub_department.id})

@api_router.put("/sub-departments/{sub_dept_id}", response_model=APIResponse)
async def update_sub_department(sub_dept_id: str, sub_dept_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing sub-department
    existing_sub_dept = await db.sub_departments.find_one({"id": sub_dept_id, "is_deleted": False})
    if not existing_sub_dept:
        raise HTTPException(status_code=404, detail="Sub-department not found")
    
    # Validate required fields
    if not sub_dept_data.get("name"):
        raise HTTPException(status_code=400, detail="Sub-department name is required")
    
    # Check if another sub-department in the same department has the same name
    name_check = await db.sub_departments.find_one({
        "name": sub_dept_data["name"], 
        "department_id": existing_sub_dept["department_id"],
        "is_deleted": False,
        "id": {"$ne": sub_dept_id}
    })
    if name_check:
        raise HTTPException(status_code=400, detail="Another sub-department with this name already exists in this department")
    
    # Update sub-department
    update_data = {
        "name": sub_dept_data["name"],
        "description": sub_dept_data.get("description", existing_sub_dept.get("description", "")),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.sub_departments.update_one({"id": sub_dept_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated sub-department: {sub_dept_data['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Sub-department updated successfully")

@api_router.delete("/sub-departments/{sub_dept_id}", response_model=APIResponse)
async def delete_sub_department(sub_dept_id: str, current_user: User = Depends(get_current_user)):
    # Find existing sub-department
    sub_dept = await db.sub_departments.find_one({"id": sub_dept_id, "is_deleted": False})
    if not sub_dept:
        raise HTTPException(status_code=404, detail="Sub-department not found")
    
    # Soft delete the sub-department
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.sub_departments.update_one({"id": sub_dept_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted sub-department: {sub_dept['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Sub-department deleted successfully")

# Business Verticals Management endpoints
@api_router.get("/business-verticals", response_model=APIResponse)
async def get_business_verticals(current_user: User = Depends(get_current_user)):
    verticals = await db.business_verticals.find({"is_deleted": False}).to_list(1000)
    verticals_data = [BusinessVertical(**vertical).dict() for vertical in verticals]
    return APIResponse(success=True, message="Business verticals retrieved", data=verticals_data)

@api_router.post("/business-verticals", response_model=APIResponse)
async def create_business_vertical(vertical_data: dict, current_user: User = Depends(get_current_user)):
    # Validate required fields
    if not vertical_data.get("name"):
        raise HTTPException(status_code=400, detail="Business vertical name is required")
    
    # Check if vertical already exists
    existing_vertical = await db.business_verticals.find_one({"name": vertical_data["name"], "is_deleted": False})
    if existing_vertical:
        raise HTTPException(status_code=400, detail="Business vertical with this name already exists")
    
    vertical = BusinessVertical(
        name=vertical_data["name"],
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    await db.business_verticals.insert_one(vertical.dict())
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Created business vertical: {vertical.name}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Business vertical created successfully", data={"vertical_id": vertical.id})

@api_router.put("/business-verticals/{vertical_id}", response_model=APIResponse)
async def update_business_vertical(vertical_id: str, vertical_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing vertical
    existing_vertical = await db.business_verticals.find_one({"id": vertical_id, "is_deleted": False})
    if not existing_vertical:
        raise HTTPException(status_code=404, detail="Business vertical not found")
    
    # Validate required fields
    if not vertical_data.get("name"):
        raise HTTPException(status_code=400, detail="Business vertical name is required")
    
    # Check if another vertical has the same name
    name_check = await db.business_verticals.find_one({
        "name": vertical_data["name"], 
        "is_deleted": False,
        "id": {"$ne": vertical_id}
    })
    if name_check:
        raise HTTPException(status_code=400, detail="Another business vertical with this name already exists")
    
    # Update vertical
    update_data = {
        "name": vertical_data["name"],
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.business_verticals.update_one({"id": vertical_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Updated business vertical: {vertical_data['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Business vertical updated successfully")

@api_router.delete("/business-verticals/{vertical_id}", response_model=APIResponse)
async def delete_business_vertical(vertical_id: str, current_user: User = Depends(get_current_user)):
    # Find existing vertical
    vertical = await db.business_verticals.find_one({"id": vertical_id, "is_deleted": False})
    if not vertical:
        raise HTTPException(status_code=404, detail="Business vertical not found")
    
    # Soft delete the vertical
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.business_verticals.update_one({"id": vertical_id}, {"$set": update_data})
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Deleted business vertical: {vertical['name']}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Business vertical deleted successfully")

# File Upload endpoint for profile photos
@api_router.post("/upload/profile-photo", response_model=APIResponse)
async def upload_profile_photo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only image files (JPEG, PNG, GIF, WebP) are allowed")
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1].lower()
    unique_filename = f"profile_{uuid.uuid4()}.{file_extension}"
    file_path = UPLOAD_DIR / "profile_photos" / unique_filename
    
    # Create profile_photos directory if it doesn't exist
    file_path.parent.mkdir(exist_ok=True)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)
    
    # Return relative path for database storage
    relative_path = f"/uploads/profile_photos/{unique_filename}"
    
    # Log activity
    activity_log = ActivityLog(user_id=current_user.id, action=f"Uploaded profile photo: {unique_filename}")
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(
        success=True, 
        message="Profile photo uploaded successfully", 
        data={"file_path": relative_path, "filename": unique_filename}
    )

# File Upload endpoint for opportunity documents
@api_router.post("/opportunities/{opportunity_id}/upload-document", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def upload_opportunity_document(
    opportunity_id: str,
    file: UploadFile = File(...), 
    document_type: str = None,
    current_user: User = Depends(get_current_user)
):
    """Upload document for opportunity (proposals, signatures, etc.)"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Validate file type and size
        allowed_types = [
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg', 'image/png', 'image/gif', 'image/webp'
        ]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Only PDF, DOC, DOCX, and image files are allowed.")
        
        # Check file size (10MB limit)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1].lower()
        unique_filename = f"opp_{opportunity_id}_{document_type or 'doc'}_{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / "opportunity_documents" / unique_filename
        
        # Create opportunity_documents directory if it doesn't exist
        file_path.parent.mkdir(exist_ok=True)
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(contents)
        
        # Store document metadata in database
        document_record = {
            "id": str(uuid.uuid4()),
            "opportunity_id": opportunity_id,
            "document_type": document_type or "general",
            "original_filename": file.filename,
            "stored_filename": unique_filename,
            "file_path": f"/uploads/opportunity_documents/{unique_filename}",
            "file_size": len(contents),
            "content_type": file.content_type,
            "uploaded_by": current_user.id,
            "uploaded_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        await db.opportunity_documents.insert_one(document_record)
        
        # Log activity
        activity_log = ActivityLog(
            user_id=current_user.id, 
            action=f"Uploaded document for opportunity {opportunity_id}: {file.filename}"
        )
        await db.activity_logs.insert_one(activity_log.dict())
        
        return APIResponse(
            success=True, 
            message="Document uploaded successfully", 
            data={
                "document_id": document_record["id"],
                "file_path": document_record["file_path"], 
                "filename": unique_filename,
                "original_filename": file.filename
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Role-Permission Mapping endpoints
@api_router.get("/role-permissions", response_model=APIResponse)
async def get_role_permissions(current_user: User = Depends(get_current_user)):
    role_permissions = await db.role_permissions.find({"is_deleted": False}).to_list(1000)
    
    # Enrich with role and menu names
    for rp in role_permissions:
        # Remove MongoDB _id field to avoid serialization issues
        rp.pop("_id", None)
        
        # Get role name
        role = await db.roles.find_one({"id": rp["role_id"], "is_deleted": False})
        rp["role_name"] = role["name"] if role else "Unknown"
        
        # Get menu name
        menu = await db.menus.find_one({"id": rp["menu_id"], "is_deleted": False})
        rp["menu_name"] = menu["name"] if menu else "Unknown"
        
        # Get permission names
        permission_names = []
        for perm_id in rp["permission_ids"]:
            perm = await db.permissions.find_one({"id": perm_id})
            if perm:
                permission_names.append(perm["name"])
        rp["permission_names"] = permission_names
    
    return APIResponse(success=True, message="Role permissions retrieved", data=role_permissions)

@api_router.get("/role-permissions/role/{role_id}", response_model=APIResponse)
async def get_role_permissions_by_role(role_id: str, current_user: User = Depends(get_current_user)):
    # Check if role exists
    role = await db.roles.find_one({"id": role_id, "is_deleted": False})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role_permissions = await db.role_permissions.find({"role_id": role_id, "is_deleted": False}).to_list(1000)
    
    # Group by menu and enrich with names
    grouped_permissions = {}
    for rp in role_permissions:
        menu_id = rp["menu_id"]
        
        # Get menu details
        menu = await db.menus.find_one({"id": menu_id, "is_deleted": False})
        if not menu:
            continue
            
        if menu_id not in grouped_permissions:
            grouped_permissions[menu_id] = {
                "menu_id": menu_id,
                "menu_name": menu["name"],
                "menu_path": menu["path"],
                "permissions": [],
                "mapping_id": rp["id"]
            }
        
        # Get permission details
        for perm_id in rp["permission_ids"]:
            perm = await db.permissions.find_one({"id": perm_id})
            if perm:
                grouped_permissions[menu_id]["permissions"].append({
                    "id": perm["id"],
                    "name": perm["name"],
                    "description": perm.get("description", "")
                })
    
    return APIResponse(
        success=True, 
        message=f"Permissions for role '{role['name']}' retrieved", 
        data={
            "role_id": role_id,
            "role_name": role["name"],
            "permissions_by_menu": list(grouped_permissions.values())
        }
    )

@api_router.post("/role-permissions", response_model=APIResponse)
async def create_role_permission(
    role_permission_data: dict,
    current_user: User = Depends(get_current_user)
):
    # Validate required fields
    if not all(key in role_permission_data for key in ["role_id", "menu_id", "permission_ids"]):
        raise HTTPException(status_code=400, detail="role_id, menu_id, and permission_ids are required")
    
    role_id = role_permission_data["role_id"]
    menu_id = role_permission_data["menu_id"]
    permission_ids = role_permission_data["permission_ids"]
    
    # Validate role exists
    role = await db.roles.find_one({"id": role_id, "is_deleted": False})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Validate menu exists
    menu = await db.menus.find_one({"id": menu_id, "is_deleted": False})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Validate all permissions exist
    for perm_id in permission_ids:
        perm = await db.permissions.find_one({"id": perm_id})
        if not perm:
            raise HTTPException(status_code=404, detail=f"Permission {perm_id} not found")
    
    # Check if mapping already exists
    existing = await db.role_permissions.find_one({
        "role_id": role_id,
        "menu_id": menu_id,
        "is_deleted": False
    })
    
    if existing:
        # Update existing mapping
        update_data = {
            "permission_ids": permission_ids,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user.id
        }
        await db.role_permissions.update_one({"id": existing["id"]}, {"$set": update_data})
        
        # Log activity
        activity_log = ActivityLog(
            user_id=current_user.id, 
            action=f"Updated role-permission mapping for role '{role['name']}' and menu '{menu['name']}'"
        )
        await db.activity_logs.insert_one(activity_log.dict())
        
        return APIResponse(success=True, message="Role-permission mapping updated successfully")
    else:
        # Create new mapping
        new_role_permission = RolePermission(
            role_id=role_id,
            menu_id=menu_id,
            permission_ids=permission_ids,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        
        await db.role_permissions.insert_one(new_role_permission.dict())
        
        # Log activity
        activity_log = ActivityLog(
            user_id=current_user.id, 
            action=f"Created role-permission mapping for role '{role['name']}' and menu '{menu['name']}'"
        )
        await db.activity_logs.insert_one(activity_log.dict())
        
        return APIResponse(success=True, message="Role-permission mapping created successfully")

@api_router.put("/role-permissions/{mapping_id}", response_model=APIResponse)
async def update_role_permission(
    mapping_id: str,
    role_permission_data: dict,
    current_user: User = Depends(get_current_user)
):
    # Find existing mapping
    existing = await db.role_permissions.find_one({"id": mapping_id, "is_deleted": False})
    if not existing:
        raise HTTPException(status_code=404, detail="Role-permission mapping not found")
    
    # Validate permission_ids if provided
    if "permission_ids" in role_permission_data:
        permission_ids = role_permission_data["permission_ids"]
        for perm_id in permission_ids:
            perm = await db.permissions.find_one({"id": perm_id})
            if not perm:
                raise HTTPException(status_code=404, detail=f"Permission {perm_id} not found")
    
    # Update mapping
    update_data = {
        "permission_ids": role_permission_data.get("permission_ids", existing["permission_ids"]),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.role_permissions.update_one({"id": mapping_id}, {"$set": update_data})
    
    # Get role and menu names for logging
    role = await db.roles.find_one({"id": existing["role_id"], "is_deleted": False})
    menu = await db.menus.find_one({"id": existing["menu_id"], "is_deleted": False})
    
    # Log activity
    activity_log = ActivityLog(
        user_id=current_user.id, 
        action=f"Updated role-permission mapping for role '{role['name'] if role else 'Unknown'}' and menu '{menu['name'] if menu else 'Unknown'}'"
    )
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Role-permission mapping updated successfully")

@api_router.delete("/role-permissions/{mapping_id}", response_model=APIResponse)
async def delete_role_permission(mapping_id: str, current_user: User = Depends(get_current_user)):
    # Find existing mapping
    existing = await db.role_permissions.find_one({"id": mapping_id, "is_deleted": False})
    if not existing:
        raise HTTPException(status_code=404, detail="Role-permission mapping not found")
    
    # Soft delete the mapping
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.role_permissions.update_one({"id": mapping_id}, {"$set": update_data})
    
    # Get role and menu names for logging
    role = await db.roles.find_one({"id": existing["role_id"], "is_deleted": False})
    menu = await db.menus.find_one({"id": existing["menu_id"], "is_deleted": False})
    
    # Log activity
    activity_log = ActivityLog(
        user_id=current_user.id, 
        action=f"Deleted role-permission mapping for role '{role['name'] if role else 'Unknown'}' and menu '{menu['name'] if menu else 'Unknown'}'"
    )
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Role-permission mapping deleted successfully")

@api_router.delete("/role-permissions/role/{role_id}/menu/{menu_id}", response_model=APIResponse)
async def delete_role_permission_by_role_menu(
    role_id: str, 
    menu_id: str, 
    current_user: User = Depends(get_current_user)
):
    # Find existing mapping
    existing = await db.role_permissions.find_one({
        "role_id": role_id,
        "menu_id": menu_id,
        "is_deleted": False
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Role-permission mapping not found")
    
    # Soft delete the mapping
    update_data = {
        "is_deleted": True,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.id
    }
    
    await db.role_permissions.update_one({"id": existing["id"]}, {"$set": update_data})
    
    # Get role and menu names for logging
    role = await db.roles.find_one({"id": role_id, "is_deleted": False})
    menu = await db.menus.find_one({"id": menu_id, "is_deleted": False})
    
    # Log activity
    activity_log = ActivityLog(
        user_id=current_user.id, 
        action=f"Removed permissions for role '{role['name'] if role else 'Unknown'}' from menu '{menu['name'] if menu else 'Unknown'}'"
    )
    await db.activity_logs.insert_one(activity_log.dict())
    
    return APIResponse(success=True, message="Role-permission mapping removed successfully")

# Activity and Login Logs Reporting endpoints
@api_router.get("/logs/activity", response_model=APIResponse)
async def get_activity_logs(
    page: int = 1,
    limit: int = 50,
    user_id: Optional[str] = None,
    action_filter: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get activity logs with filtering and pagination"""
    skip = (page - 1) * limit
    
    # Build filter query
    filter_query = {"is_active": True}
    
    if user_id:
        filter_query["user_id"] = user_id
        
    if action_filter:
        filter_query["action"] = {"$regex": action_filter, "$options": "i"}
        
    if start_date or end_date:
        date_filter = {}
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                date_filter["$gte"] = start_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format")
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                date_filter["$lte"] = end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format")
        if date_filter:
            filter_query["timestamp"] = date_filter
    
    # Get total count for pagination
    total_count = await db.activity_logs.count_documents(filter_query)
    
    # Get logs with pagination
    logs = await db.activity_logs.find(filter_query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user information
    enriched_logs = []
    for log in logs:
        user = await db.users.find_one({"id": log["user_id"], "is_deleted": False})
        log_data = ActivityLog(**log).dict()
        log_data["user_name"] = user["name"] if user else "Unknown User"
        log_data["user_email"] = user["email"] if user else "Unknown Email"
        enriched_logs.append(log_data)
    
    return APIResponse(
        success=True, 
        message="Activity logs retrieved", 
        data={
            "logs": enriched_logs,
            "pagination": {
                "current_page": page,
                "total_pages": (total_count + limit - 1) // limit,
                "total_items": total_count,
                "items_per_page": limit
            }
        }
    )

@api_router.get("/logs/login", response_model=APIResponse)
async def get_login_logs(
    page: int = 1,
    limit: int = 50,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get login logs with filtering and pagination"""
    skip = (page - 1) * limit
    
    # Build filter query
    filter_query = {"is_active": True}
    
    if user_id:
        filter_query["user_id"] = user_id
        
    if start_date or end_date:
        date_filter = {}
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                date_filter["$gte"] = start_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format")
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                date_filter["$lte"] = end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format")
        if date_filter:
            filter_query["login_time"] = date_filter
    
    # Get total count for pagination
    total_count = await db.login_logs.count_documents(filter_query)
    
    # Get logs with pagination
    logs = await db.login_logs.find(filter_query).sort("login_time", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user information
    enriched_logs = []
    for log in logs:
        user = await db.users.find_one({"id": log["user_id"], "is_deleted": False})
        log_data = LoginLog(**log).dict()
        log_data["user_name"] = user["name"] if user else "Unknown User"
        log_data["user_email"] = user["email"] if user else "Unknown Email"
        enriched_logs.append(log_data)
    
    return APIResponse(
        success=True, 
        message="Login logs retrieved", 
        data={
            "logs": enriched_logs,
            "pagination": {
                "current_page": page,
                "total_pages": (total_count + limit - 1) // limit,
                "total_items": total_count,
                "items_per_page": limit
            }
        }
    )

@api_router.get("/logs/analytics", response_model=APIResponse)
async def get_logs_analytics(
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get analytics data for logs dashboard"""
    from datetime import timedelta
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Activity logs analytics
    activity_pipeline = [
        {"$match": {
            "is_active": True,
            "timestamp": {"$gte": start_date, "$lte": end_date}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    activity_by_date = await db.activity_logs.aggregate(activity_pipeline).to_list(days)
    
    # Activity by action type
    action_pipeline = [
        {"$match": {
            "is_active": True,
            "timestamp": {"$gte": start_date, "$lte": end_date}
        }},
        {"$group": {
            "_id": {"$regexFind": {"input": "$action", "regex": r"^(Created|Updated|Deleted)"}},
            "count": {"$sum": 1}
        }},
        {"$project": {
            "action_type": {"$ifNull": ["$_id.match", "Other"]},
            "count": 1
        }}
    ]
    
    activity_by_action = await db.activity_logs.aggregate(action_pipeline).to_list(10)
    
    # Login logs analytics
    login_pipeline = [
        {"$match": {
            "is_active": True,
            "login_time": {"$gte": start_date, "$lte": end_date}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$login_time"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    logins_by_date = await db.login_logs.aggregate(login_pipeline).to_list(days)
    
    # Most active users
    user_activity_pipeline = [
        {"$match": {
            "is_active": True,
            "timestamp": {"$gte": start_date, "$lte": end_date}
        }},
        {"$group": {
            "_id": "$user_id",
            "activity_count": {"$sum": 1}
        }},
        {"$sort": {"activity_count": -1}},
        {"$limit": 10}
    ]
    
    user_activities = await db.activity_logs.aggregate(user_activity_pipeline).to_list(10)
    
    # Enrich user activities with user names
    enriched_user_activities = []
    for activity in user_activities:
        user = await db.users.find_one({"id": activity["_id"], "is_deleted": False})
        enriched_user_activities.append({
            "user_id": activity["_id"],
            "user_name": user["name"] if user else "Unknown User",
            "activity_count": activity["activity_count"]
        })
    
    # Summary statistics
    total_activities = await db.activity_logs.count_documents({
        "is_active": True,
        "timestamp": {"$gte": start_date, "$lte": end_date}
    })
    
    total_logins = await db.login_logs.count_documents({
        "is_active": True,
        "login_time": {"$gte": start_date, "$lte": end_date}
    })
    
    unique_active_users = len(await db.activity_logs.distinct("user_id", {
        "is_active": True,
        "timestamp": {"$gte": start_date, "$lte": end_date}
    }))
    
    return APIResponse(
        success=True,
        message="Analytics data retrieved",
        data={
            "summary": {
                "total_activities": total_activities,
                "total_logins": total_logins,
                "unique_active_users": unique_active_users,
                "date_range_days": days
            },
            "activity_by_date": activity_by_date,
            "activity_by_action": activity_by_action,
            "logins_by_date": logins_by_date,
            "most_active_users": enriched_user_activities
        }
    )

@api_router.get("/logs/export/activity", response_model=APIResponse)
async def export_activity_logs(
    format: str = "csv",
    user_id: Optional[str] = None,
    action_filter: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Export activity logs to CSV format"""
    if format.lower() != "csv":
        raise HTTPException(status_code=400, detail="Only CSV format is currently supported")
    
    # Build filter query (same as get_activity_logs)
    filter_query = {"is_active": True}
    
    if user_id:
        filter_query["user_id"] = user_id
        
    if action_filter:
        filter_query["action"] = {"$regex": action_filter, "$options": "i"}
        
    if start_date or end_date:
        date_filter = {}
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                date_filter["$gte"] = start_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format")
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                date_filter["$lte"] = end_dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format")
        if date_filter:
            filter_query["timestamp"] = date_filter
    
    # Get all matching logs (limit to 10000 for performance)
    logs = await db.activity_logs.find(filter_query).sort("timestamp", -1).limit(10000).to_list(10000)
    
    # Create CSV content
    csv_content = "Date,Time,User Name,User Email,Action\n"
    
    for log in logs:
        user = await db.users.find_one({"id": log["user_id"], "is_deleted": False})
        timestamp = log["timestamp"]
        date_str = timestamp.strftime("%Y-%m-%d")
        time_str = timestamp.strftime("%H:%M:%S")
        user_name = user["name"] if user else "Unknown User"
        user_email = user["email"] if user else "Unknown Email"
        action = log["action"].replace('"', '""')  # Escape quotes for CSV
        
        csv_content += f'"{date_str}","{time_str}","{user_name}","{user_email}","{action}"\n'
    
    return APIResponse(
        success=True,
        message="Activity logs exported successfully",
        data={
            "filename": f"activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            "content": csv_content,
            "total_records": len(logs)
        }
    )

# Initialize QMS master data
async def initialize_qms_master_data():
    """Initialize Quotation Management System master data"""
    
    # Initialize default approval workflows
    default_workflows = [
        {
            "workflow_name": "Standard Approval",
            "quotation_value_min": 0.0,
            "quotation_value_max": 500000.0,
            "required_approvers": 1,
            "approval_sequence": "sequential"
        },
        {
            "workflow_name": "High Value Approval", 
            "quotation_value_min": 500000.0,
            "quotation_value_max": 2000000.0,
            "required_approvers": 2,
            "approval_sequence": "sequential"
        },
        {
            "workflow_name": "Enterprise Approval",
            "quotation_value_min": 2000000.0,
            "quotation_value_max": 999999999.0,
            "required_approvers": 3,
            "approval_sequence": "sequential"
        }
    ]
    
    for workflow_data in default_workflows:
        existing = await db.approval_workflows.find_one({
            "workflow_name": workflow_data["workflow_name"],
            "is_deleted": False
        })
        if not existing:
            workflow = ApprovalWorkflow(**workflow_data)
            await db.approval_workflows.insert_one(workflow.dict())
    
    # Initialize default discount rules
    default_discount_rules = [
        {
            "rule_name": "Volume Discount - Tier 1",
            "rule_description": "5% discount for quantities above 10 units",
            "min_quantity": 10.0,
            "max_quantity": 50.0,
            "discount_type": "percentage",
            "discount_value": 5.0,
            "priority_order": 1,
            "requires_approval": False
        },
        {
            "rule_name": "Volume Discount - Tier 2", 
            "rule_description": "10% discount for quantities above 50 units",
            "min_quantity": 50.0,
            "max_quantity": 100.0,
            "discount_type": "percentage",
            "discount_value": 10.0,
            "priority_order": 2,
            "requires_approval": True,
            "approval_threshold": 100000.0
        },
        {
            "rule_name": "Enterprise Discount",
            "rule_description": "15% discount for high-value deals",
            "min_value": 1000000.0,
            "discount_type": "percentage", 
            "discount_value": 15.0,
            "priority_order": 3,
            "requires_approval": True,
            "approval_threshold": 1000000.0
        }
    ]
    
    for rule_data in default_discount_rules:
        existing = await db.discount_rules.find_one({
            "rule_name": rule_data["rule_name"],
            "is_deleted": False
        })
        if not existing:
            rule = DiscountRule(**rule_data)
            await db.discount_rules.insert_one(rule.dict())
    
    # Initialize default export templates
    default_templates = [
        {
            "template_name": "Standard PDF Template",
            "template_type": "pdf",
            "is_default": True,
            "include_cover_page": True,
            "include_terms": True,
            "include_yearly_breakdown": True,
            "include_category_grouping": False
        },
        {
            "template_name": "Executive Summary PDF",
            "template_type": "pdf", 
            "is_default": False,
            "include_cover_page": True,
            "include_terms": False,
            "include_yearly_breakdown": False,
            "include_category_grouping": True
        },
        {
            "template_name": "Detailed Excel Export",
            "template_type": "excel",
            "is_default": False,
            "include_cover_page": False,
            "include_terms": True,
            "include_yearly_breakdown": True,
            "include_category_grouping": True
        }
    ]
    
    for template_data in default_templates:
        existing = await db.export_templates.find_one({
            "template_name": template_data["template_name"],
            "is_deleted": False
        })
        if not existing:
            template = ExportTemplate(**template_data)
            await db.export_templates.insert_one(template.dict())
    
    # Initialize product catalog and pricing
    default_products = [
        {
            "core_product_name": "Cloud Compute - Standard VM",
            "skucode": "CC-STD-VM-001",
            "primary_category": "Infrastructure",
            "secondary_category": "Compute",
            "tertiary_category": "Virtual Machines",
            "fourth_category": "Standard VMs",
            "fifth_category": "4 CPU Tier",
            "product_description": "Standard virtual machine with 4 CPU cores and 16GB RAM",
            "unit_of_measure": "Hour"
        },
        {
            "core_product_name": "Database Service - MySQL",
            "skucode": "DB-MYSQL-001",
            "primary_category": "Platform",
            "secondary_category": "Database",
            "tertiary_category": "Relational DB",
            "fourth_category": "MySQL",
            "fifth_category": "Standard",
            "product_description": "Managed MySQL database service",
            "unit_of_measure": "Month"
        },
        {
            "core_product_name": "Storage - Block Storage",
            "skucode": "STG-BLOCK-001",
            "primary_category": "Infrastructure",
            "secondary_category": "Storage",
            "tertiary_category": "Block Storage",
            "fourth_category": "SSD",
            "fifth_category": "High Performance",
            "product_description": "High-performance SSD block storage",
            "unit_of_measure": "GB/Month"
        },
        {
            "core_product_name": "Network Load Balancer",
            "skucode": "NET-LB-001",
            "primary_category": "Network",
            "secondary_category": "Load Balancer",
            "tertiary_category": "Application LB",
            "fourth_category": "Layer 7",
            "fifth_category": "Standard",
            "product_description": "Application load balancer with SSL termination",
            "unit_of_measure": "Hour"
        },
        {
            "core_product_name": "Security - Web Application Firewall",
            "skucode": "SEC-WAF-001",
            "primary_category": "Security",
            "secondary_category": "Firewall",
            "tertiary_category": "Web App Firewall",
            "fourth_category": "Standard",
            "fifth_category": "Basic",
            "product_description": "Web application firewall with DDoS protection",
            "unit_of_measure": "Month"
        }
    ]
    
    for product_data in default_products:
        existing = await db.core_product_model.find_one({
            "skucode": product_data["skucode"],
            "is_deleted": False
        })
        if not existing:
            product = CoreProductModel(**product_data)
            result = await db.core_product_model.insert_one(product.dict())
            
            # Create pricing model for this product
            pricing_data = {
                "core_product_id": product.id,
                "pricing_model_name": f"{product_data['core_product_name']} - Standard Pricing",
                "selling_price": 100.0 if "VM" in product_data["core_product_name"] else 
                                 50.0 if "Database" in product_data["core_product_name"] else
                                 25.0 if "Storage" in product_data["core_product_name"] else
                                 75.0 if "Load Balancer" in product_data["core_product_name"] else 200.0,
                "selling_price_y2": 95.0 if "VM" in product_data["core_product_name"] else 
                                    48.0 if "Database" in product_data["core_product_name"] else
                                    24.0 if "Storage" in product_data["core_product_name"] else
                                    72.0 if "Load Balancer" in product_data["core_product_name"] else 190.0,
                "recurring_selling_price": 90.0 if "VM" in product_data["core_product_name"] else 
                                           45.0 if "Database" in product_data["core_product_name"] else
                                           23.0 if "Storage" in product_data["core_product_name"] else
                                           70.0 if "Load Balancer" in product_data["core_product_name"] else 180.0
            }
            pricing = PricingModel(**pricing_data)
            await db.pricing_models.insert_one(pricing.dict())
    
    # Initialize default pricing lists
    default_pricing_lists = [
        {
            "name": "Standard Pricing List",
            "description": "Standard pricing for all customers",
            "effective_date": "2025-01-01",
            "markup_percentage": 0.0,
            "is_default": True
        },
        {
            "name": "Enterprise Pricing List",
            "description": "Discounted pricing for enterprise customers",
            "effective_date": "2025-01-01",
            "markup_percentage": -10.0
        },
        {
            "name": "Government Pricing List",
            "description": "Special pricing for government customers",
            "effective_date": "2025-01-01",
            "markup_percentage": -15.0
        }
    ]
    
    for pricing_list_data in default_pricing_lists:
        existing = await db.pricing_list.find_one({
            "name": pricing_list_data["name"],
            "is_deleted": False
        })
        if not existing:
            pricing_list = PricingList(**pricing_list_data)
            await db.pricing_list.insert_one(pricing_list.dict())

# Initialize database with default data
# Database initialization endpoint
@api_router.post("/init-db", response_model=APIResponse)
async def initialize_database():
    """Initialize database with comprehensive default data"""
    try:
        # Initialize Business Verticals with enhanced default values
        default_verticals = [
            "Government",
            "BFSI", 
            "Education",
            "Healthcare", 
            "Manufacturing",
            "Retail",
            "IT/ITES"
        ]
        
        for vertical_name in default_verticals:
            existing = await db.business_verticals.find_one({"name": vertical_name, "is_deleted": False})
            if not existing:
                vertical = BusinessVertical(name=vertical_name)
                await db.business_verticals.insert_one(vertical.dict())
        
        # Initialize default permissions
        default_permissions = [
            {"name": "view", "description": "View access to resources"},
            {"name": "create", "description": "Create new resources"},
            {"name": "edit", "description": "Edit existing resources"},
            {"name": "delete", "description": "Delete resources"}
        ]
        
        for perm_data in default_permissions:
            existing_perm = await db.permissions.find_one({"name": perm_data["name"]})
            if not existing_perm:
                permission = Permission(**perm_data)
                await db.permissions.insert_one(permission.dict())
        
        # Initialize default menus
        default_menus = [
            {"name": "Dashboard", "path": "/dashboard"},
            {"name": "Users", "path": "/users"},
            {"name": "Roles", "path": "/roles"},
            {"name": "Departments", "path": "/departments"},
            {"name": "Permissions", "path": "/permissions"},
            {"name": "Menus", "path": "/menus"},
            {"name": "Partners", "path": "/partners"},
            {"name": "Companies", "path": "/companies"},
            {"name": "Leads", "path": "/leads"},
            {"name": "Opportunities", "path": "/opportunities"}
        ]
        
        menu_ids = {}
        for menu_data in default_menus:
            existing_menu = await db.menus.find_one({"name": menu_data["name"], "is_deleted": False})
            if not existing_menu:
                menu = Menu(**menu_data)
                await db.menus.insert_one(menu.dict())
                menu_ids[menu_data["name"]] = menu.id
            else:
                menu_ids[menu_data["name"]] = existing_menu["id"]
        
        # Initialize default departments
        default_departments = [
            {"name": "IT", "description": "Information Technology"},
            {"name": "HR", "description": "Human Resources"},
            {"name": "Finance", "description": "Finance Department"},
            {"name": "Sales", "description": "Sales Department"},
            {"name": "Marketing", "description": "Marketing Department"},
            {"name": "Operations", "description": "Operations Department"}
        ]
        
        for dept_data in default_departments:
            existing_dept = await db.departments.find_one({"name": dept_data["name"], "is_deleted": False})
            if not existing_dept:
                department = Department(**dept_data)
                await db.departments.insert_one(department.dict())
        
        # Initialize default roles
        default_roles = [
            {"name": "Admin", "description": "Administrator with full system access"},
            {"name": "Manager", "description": "Manager with departmental access"},
            {"name": "Employee", "description": "Employee with basic access"},
            {"name": "User", "description": "Basic user access"}
        ]
        
        admin_role_id = None
        for role_data in default_roles:
            existing_role = await db.roles.find_one({"name": role_data["name"], "is_deleted": False})
            if not existing_role:
                role = Role(**role_data)
                await db.roles.insert_one(role.dict())
                if role_data["name"] == "Admin":
                    admin_role_id = role.id
            else:
                if role_data["name"] == "Admin":
                    admin_role_id = existing_role["id"]
        
        # Create comprehensive role-permission mappings for Admin
        if admin_role_id:
            # Get all permissions
            all_permissions = await db.permissions.find({}).to_list(1000)
            permission_ids = [perm["id"] for perm in all_permissions]
            
            # Assign all permissions to all menus for Admin role
            for menu_name, menu_id in menu_ids.items():
                existing_mapping = await db.role_permissions.find_one({
                    "role_id": admin_role_id,
                    "menu_id": menu_id,
                    "is_deleted": False
                })
                
                if not existing_mapping:
                    role_permission = RolePermission(
                        role_id=admin_role_id,
                        menu_id=menu_id,
                        permission_ids=permission_ids
                    )
                    await db.role_permissions.insert_one(role_permission.dict())
        
        # Initialize Sales Module Master Data
        # Job Functions
        job_functions = [
            "CEO", "CTO", "CFO", "Manager", "Senior Developer", "Developer",
            "Business Analyst", "Sales Manager", "Marketing Manager", "HR Manager",
            "Finance Manager", "Operations Manager", "Team Lead", "Consultant"
        ]
        
        for job_func_name in job_functions:
            existing = await db.job_function_master.find_one({"job_function_name": job_func_name, "is_deleted": False})
            if not existing:
                job_func = JobFunctionMaster(job_function_name=job_func_name)
                await db.job_function_master.insert_one(job_func.dict())
        
        # Partner Types
        partner_types = ["Client", "Vendor", "Supplier", "Distributor", "Reseller", "Strategic Partner"]
        for partner_type_name in partner_types:
            existing = await db.partner_type_master.find_one({"partner_type_name": partner_type_name, "is_deleted": False})
            if not existing:
                partner_type = PartnerTypeMaster(partner_type_name=partner_type_name)
                await db.partner_type_master.insert_one(partner_type.dict())
        
        # Company Types
        company_types = ["Private Limited", "Public Limited", "Partnership", "LLP", "Sole Proprietorship", "NGO", "Government"]
        for company_type_name in company_types:
            existing = await db.company_type_master.find_one({"company_type_name": company_type_name, "is_deleted": False})
            if not existing:
                company_type = CompanyTypeMaster(company_type_name=company_type_name)
                await db.company_type_master.insert_one(company_type.dict())
        
        # Head of Company
        head_roles = ["CEO", "President", "Managing Director", "Chairman", "Founder", "Director"]
        for head_role_name in head_roles:
            existing = await db.head_of_company_master.find_one({"head_role_name": head_role_name, "is_deleted": False})
            if not existing:
                head_role = HeadOfCompanyMaster(head_role_name=head_role_name)
                await db.head_of_company_master.insert_one(head_role.dict())
        
        # Countries (basic set)
        countries = [
            {"country_name": "India", "country_code": "IN"},
            {"country_name": "United States", "country_code": "US"},
            {"country_name": "United Kingdom", "country_code": "UK"},
            {"country_name": "Canada", "country_code": "CA"},
            {"country_name": "Australia", "country_code": "AU"}
        ]
        
        for country_data in countries:
            existing = await db.master_countries.find_one({"country_name": country_data["country_name"], "is_deleted": False})
            if not existing:
                country = MasterCountries(**country_data)
                await db.master_countries.insert_one(country.dict())
        
        # Document Types
        document_types = ["PAN Card", "Aadhar Card", "GST Certificate", "Incorporation Certificate", "MOA", "AOA", "Contract", "Invoice"]
        for doc_type_name in document_types:
            existing = await db.master_document_types.find_one({"document_type_name": doc_type_name, "is_deleted": False})
            if not existing:
                doc_type = MasterDocumentTypes(document_type_name=doc_type_name)
                await db.master_document_types.insert_one(doc_type.dict())
        
        # Initialize currencies with sample data
        currencies_data = [
            {"currency_code": "INR", "currency_name": "Indian Rupee", "currency_symbol": "₹"},
            {"currency_code": "USD", "currency_name": "US Dollar", "currency_symbol": "$"},
            {"currency_code": "EUR", "currency_name": "Euro", "currency_symbol": "€"},
            {"currency_code": "GBP", "currency_name": "British Pound", "currency_symbol": "£"},
            {"currency_code": "JPY", "currency_name": "Japanese Yen", "currency_symbol": "¥"},
            {"currency_code": "AUD", "currency_name": "Australian Dollar", "currency_symbol": "A$"},
            {"currency_code": "CAD", "currency_name": "Canadian Dollar", "currency_symbol": "C$"},
            {"currency_code": "CHF", "currency_name": "Swiss Franc", "currency_symbol": "CHF"},
            {"currency_code": "CNY", "currency_name": "Chinese Yuan", "currency_symbol": "¥"},
            {"currency_code": "SGD", "currency_name": "Singapore Dollar", "currency_symbol": "S$"}
        ]
        
        # Initialize exchange rates for currency conversion
        exchange_rates_data = [
            {"currency_code": "USD", "rate": 0.012, "base_currency": "INR"},  # 1 INR = 0.012 USD
            {"currency_code": "EUR", "rate": 0.011, "base_currency": "INR"},  # 1 INR = 0.011 EUR
            {"currency_code": "GBP", "rate": 0.009, "base_currency": "INR"},  # 1 INR = 0.009 GBP
            {"currency_code": "JPY", "rate": 1.8, "base_currency": "INR"},    # 1 INR = 1.8 JPY
            {"currency_code": "AUD", "rate": 0.018, "base_currency": "INR"},  # 1 INR = 0.018 AUD
            {"currency_code": "CAD", "rate": 0.016, "base_currency": "INR"},  # 1 INR = 0.016 CAD
            {"currency_code": "CHF", "rate": 0.011, "base_currency": "INR"},  # 1 INR = 0.011 CHF
            {"currency_code": "CNY", "rate": 0.087, "base_currency": "INR"},  # 1 INR = 0.087 CNY
            {"currency_code": "SGD", "rate": 0.016, "base_currency": "INR"}   # 1 INR = 0.016 SGD
        ]
        
        # Initialize Business Types
        business_types_data = [
            {
                "id": str(uuid.uuid4()),
                "business_type_name": "Domestic",
                "description": "Companies operating within the country",
                "validation_rules": '{"required_docs": ["PAN", "GST"]}',
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "business_type_name": "International",
                "description": "Companies operating internationally",
                "validation_rules": '{"required_docs": ["VAT"]}',
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        # Initialize Industries
        industries_data = [
            {"id": str(uuid.uuid4()), "industry_name": "IT/ITeS", "industry_code": "IT", "description": "Information Technology and IT-enabled Services", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "BFSI", "industry_code": "BFSI", "description": "Banking, Financial Services and Insurance", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Healthcare", "industry_code": "HC", "description": "Healthcare and Medical Services", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Manufacturing", "industry_code": "MFG", "description": "Manufacturing and Production", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Energy & Utilities", "industry_code": "ENERGY", "description": "Energy and Utilities Sector", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Telecom", "industry_code": "TELECOM", "description": "Telecommunications", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Retail", "industry_code": "RETAIL", "description": "Retail and Consumer Goods", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Education", "industry_code": "EDU", "description": "Education and Training", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Government", "industry_code": "GOVT", "description": "Government and Public Sector", "is_active": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "industry_name": "Real Estate", "industry_code": "RE", "description": "Real Estate and Construction", "is_active": True, "created_at": datetime.now(timezone.utc)}
        ]
        
        # Initialize Countries
        countries_data = [
            {"id": str(uuid.uuid4()), "country_name": "India", "country_code": "IN", "currency_code": "INR", "status": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "country_name": "United States", "country_code": "US", "currency_code": "USD", "status": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "country_name": "United Kingdom", "country_code": "GB", "currency_code": "GBP", "status": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "country_name": "Canada", "country_code": "CA", "currency_code": "CAD", "status": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "country_name": "Australia", "country_code": "AU", "currency_code": "AUD", "status": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "country_name": "Germany", "country_code": "DE", "currency_code": "EUR", "status": True, "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "country_name": "Singapore", "country_code": "SG", "currency_code": "SGD", "status": True, "created_at": datetime.now(timezone.utc)}
        ]
        
        for currency_data in currencies_data:
            existing = await db.master_currencies.find_one({"currency_code": currency_data["currency_code"], "is_deleted": False})
            if not existing:
                # Adjust field name to match the model
                currency_dict = {
                    "currency_code": currency_data["currency_code"],
                    "currency_name": currency_data["currency_name"],
                    "symbol": currency_data["currency_symbol"]
                }
                currency = MasterCurrencies(**currency_dict)
                await db.master_currencies.insert_one(currency.dict())
        
        # Initialize exchange rates
        for exchange_rate_data in exchange_rates_data:
            existing = await db.exchange_rates.find_one({
                "currency_code": exchange_rate_data["currency_code"], 
                "base_currency": exchange_rate_data["base_currency"],
                "is_deleted": False
            })
            if not existing:
                exchange_rate = ExchangeRate(**exchange_rate_data)
                await db.exchange_rates.insert_one(exchange_rate.dict())
        
        # Initialize Business Types
        existing_business_types = await db.business_types.count_documents({})
        if existing_business_types == 0:
            await db.business_types.insert_many(business_types_data)
            print("✅ Business Types initialized successfully")
        
        # Initialize Industries
        existing_industries = await db.industries.count_documents({})
        if existing_industries == 0:
            await db.industries.insert_many(industries_data)
            print("✅ Industries initialized successfully")
            
            # Initialize Sub-Industries after Industries
            it_industry = await db.industries.find_one({"industry_name": "IT/ITeS"})
            bfsi_industry = await db.industries.find_one({"industry_name": "BFSI"})
            healthcare_industry = await db.industries.find_one({"industry_name": "Healthcare"})
            manufacturing_industry = await db.industries.find_one({"industry_name": "Manufacturing"})
            
            sub_industries_data = []
            if it_industry:
                sub_industries_data.extend([
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Software Development", "industry_id": it_industry["id"], "sub_industry_code": "SW", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Data Analytics", "industry_id": it_industry["id"], "sub_industry_code": "DA", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Cloud Services", "industry_id": it_industry["id"], "sub_industry_code": "CLOUD", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "IT Consulting", "industry_id": it_industry["id"], "sub_industry_code": "CONSUL", "is_active": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if bfsi_industry:
                sub_industries_data.extend([
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Banking", "industry_id": bfsi_industry["id"], "sub_industry_code": "BANK", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Insurance", "industry_id": bfsi_industry["id"], "sub_industry_code": "INS", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Financial Services", "industry_id": bfsi_industry["id"], "sub_industry_code": "FS", "is_active": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if healthcare_industry:
                sub_industries_data.extend([
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Hospitals", "industry_id": healthcare_industry["id"], "sub_industry_code": "HOSP", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Pharmaceuticals", "industry_id": healthcare_industry["id"], "sub_industry_code": "PHARMA", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Medical Devices", "industry_id": healthcare_industry["id"], "sub_industry_code": "MEDDEV", "is_active": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if manufacturing_industry:
                sub_industries_data.extend([
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Automotive", "industry_id": manufacturing_industry["id"], "sub_industry_code": "AUTO", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Electronics", "industry_id": manufacturing_industry["id"], "sub_industry_code": "ELEC", "is_active": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "sub_industry_name": "Textiles", "industry_id": manufacturing_industry["id"], "sub_industry_code": "TEXT", "is_active": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if sub_industries_data:
                await db.sub_industries.insert_many(sub_industries_data)
                print("✅ Sub-Industries initialized successfully")
        
        # Initialize Countries
        existing_countries = await db.countries.count_documents({})
        if existing_countries == 0:
            await db.countries.insert_many(countries_data)
            print("✅ Countries initialized successfully")
            
            # Initialize States after Countries
            india_country = await db.countries.find_one({"country_name": "India"})
            us_country = await db.countries.find_one({"country_name": "United States"})
            uk_country = await db.countries.find_one({"country_name": "United Kingdom"})
            
            states_data = []
            if india_country:
                states_data.extend([
                    {"id": str(uuid.uuid4()), "state_name": "Maharashtra", "country_id": india_country["id"], "state_code": "MH", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "Karnataka", "country_id": india_country["id"], "state_code": "KA", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "Delhi", "country_id": india_country["id"], "state_code": "DL", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "Tamil Nadu", "country_id": india_country["id"], "state_code": "TN", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "Gujarat", "country_id": india_country["id"], "state_code": "GJ", "status": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if us_country:
                states_data.extend([
                    {"id": str(uuid.uuid4()), "state_name": "California", "country_id": us_country["id"], "state_code": "CA", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "New York", "country_id": us_country["id"], "state_code": "NY", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "Texas", "country_id": us_country["id"], "state_code": "TX", "status": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if uk_country:
                states_data.extend([
                    {"id": str(uuid.uuid4()), "state_name": "England", "country_id": uk_country["id"], "state_code": "ENG", "status": True, "created_at": datetime.now(timezone.utc)},
                    {"id": str(uuid.uuid4()), "state_name": "Scotland", "country_id": uk_country["id"], "state_code": "SCT", "status": True, "created_at": datetime.now(timezone.utc)}
                ])
            
            if states_data:
                await db.states.insert_many(states_data)
                print("✅ States initialized successfully")
                
                # Initialize Cities after States
                maharashtra_state = await db.states.find_one({"state_name": "Maharashtra"})
                karnataka_state = await db.states.find_one({"state_name": "Karnataka"})
                delhi_state = await db.states.find_one({"state_name": "Delhi"})
                california_state = await db.states.find_one({"state_name": "California"})
                
                cities_data = []
                if maharashtra_state:
                    cities_data.extend([
                        {"id": str(uuid.uuid4()), "city_name": "Mumbai", "state_id": maharashtra_state["id"], "city_code": "MUM", "status": True, "created_at": datetime.now(timezone.utc)},
                        {"id": str(uuid.uuid4()), "city_name": "Pune", "state_id": maharashtra_state["id"], "city_code": "PUN", "status": True, "created_at": datetime.now(timezone.utc)},
                        {"id": str(uuid.uuid4()), "city_name": "Nagpur", "state_id": maharashtra_state["id"], "city_code": "NAG", "status": True, "created_at": datetime.now(timezone.utc)}
                    ])
                
                if karnataka_state:
                    cities_data.extend([
                        {"id": str(uuid.uuid4()), "city_name": "Bangalore", "state_id": karnataka_state["id"], "city_code": "BLR", "status": True, "created_at": datetime.now(timezone.utc)},
                        {"id": str(uuid.uuid4()), "city_name": "Mysore", "state_id": karnataka_state["id"], "city_code": "MYS", "status": True, "created_at": datetime.now(timezone.utc)}
                    ])
                
                if delhi_state:
                    cities_data.extend([
                        {"id": str(uuid.uuid4()), "city_name": "New Delhi", "state_id": delhi_state["id"], "city_code": "ND", "status": True, "created_at": datetime.now(timezone.utc)},
                        {"id": str(uuid.uuid4()), "city_name": "Gurgaon", "state_id": delhi_state["id"], "city_code": "GUR", "status": True, "created_at": datetime.now(timezone.utc)}
                    ])
                
                if california_state:
                    cities_data.extend([
                        {"id": str(uuid.uuid4()), "city_name": "San Francisco", "state_id": california_state["id"], "city_code": "SF", "status": True, "created_at": datetime.now(timezone.utc)},
                        {"id": str(uuid.uuid4()), "city_name": "Los Angeles", "state_id": california_state["id"], "city_code": "LA", "status": True, "created_at": datetime.now(timezone.utc)}
                    ])
                
                if cities_data:
                    await db.cities.insert_many(cities_data)
                    print("✅ Cities initialized successfully")
        
        # Initialize Currencies
        existing_currencies = await db.currencies.count_documents({})
        if existing_currencies == 0:
            await db.currencies.insert_many(currencies_data)
            print("✅ Currencies initialized successfully")
        
        # Initialize Exchange Rates
        existing_rates = await db.exchange_rates.count_documents({})
        if existing_rates == 0:
            await db.exchange_rates.insert_many(exchange_rates_data)
            print("✅ Exchange Rates initialized successfully")
        
        # Create admin user if doesn't exist
        admin_email = "admin@erp.com"
        existing_admin = await db.users.find_one({"email": admin_email, "is_deleted": False})
        if not existing_admin and admin_role_id:
            # Get IT department
            it_dept = await db.departments.find_one({"name": "IT", "is_deleted": False})
            
            admin_user = User(
                name="System Administrator",
                full_name="System Administrator",
                username="admin",
                email=admin_email,
                role_id=admin_role_id,
                department_id=it_dept["id"] if it_dept else None,
                business_verticals=[]
            )
            admin_data = admin_user.dict()
            admin_data["password"] = get_password_hash("admin123")
            await db.users.insert_one(admin_data)
        
        # Initialize Lead Management master data
        await initialize_lead_management_data()
        
        # Initialize Opportunity Management system
        await initialize_opportunity_stages()
        await initialize_qualification_rules()
        
        # Initialize Quotation Management System (QMS) master data
        await initialize_qms_master_data()
        
        return APIResponse(success=True, message="Database initialized successfully with comprehensive default data including Lead Management System, Opportunity Management System, 38 Qualification Rules, and Quotation Management System")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database initialization failed: {str(e)}")



# ===== SALES MODULE API ENDPOINTS =====

# 1️⃣ Generic Master Table CRUD Endpoints
@api_router.get("/master/{table_name}", response_model=APIResponse)
@require_permission("/master", "view")
async def get_master_data(table_name: str, current_user: User = Depends(get_current_user)):
    """Generic endpoint to get master table data"""
    try:
        # Map table names to collections
        table_mapping = {
            "job-functions": "job_function_master",
            "partner-types": "partner_type_master", 
            "company-types": "company_type_master",
            "head-of-company": "head_of_company_master",
            "product-service-interests": "product_service_interest",
            "account-types": "master_account_types",
            "regions": "master_account_regions",
            "business-types": "master_business_types",
            "industry-segments": "master_industry_segments",
            "sub-industry-segments": "master_sub_industry_segments",
            "address-types": "master_address_types",
            "countries": "master_countries",
            "states": "master_states",
            "cities": "master_cities",
            "document-types": "master_document_types",
            "currencies": "master_currencies",
            # Lead Management Master Tables
            "lead-subtypes": "lead_subtype_master",
            "tender-subtypes": "tender_subtype_master",
            "submission-types": "submission_type_master",
            "clauses": "clause_master",  
            "competitors": "competitor_master",
            "designations": "designation_master",
            "billing-types": "billing_master",
            "lead-sources": "lead_source_master"
        }
        
        collection_name = table_mapping.get(table_name)
        if not collection_name:
            raise HTTPException(status_code=404, detail="Master table not found")
        
        collection = getattr(db, collection_name)
        records = await collection.find({"is_deleted": False}).to_list(1000)
        
        # Remove MongoDB _id field to avoid serialization issues
        for record in records:
            record.pop("_id", None)
        
        return APIResponse(success=True, message=f"{table_name} retrieved successfully", data=records)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/master/{table_name}", response_model=APIResponse)
@require_permission("/master", "create")
async def create_master_data(table_name: str, data: dict, current_user: User = Depends(get_current_user)):
    """Generic endpoint to create master table data"""
    try:
        # Map table names to collections and models
        table_mapping = {
            "job-functions": ("job_function_master", JobFunctionMaster, "job_function_name"),
            "partner-types": ("partner_type_master", PartnerTypeMaster, "partner_type_name"),
            "company-types": ("company_type_master", CompanyTypeMaster, "company_type_name"),
            "head-of-company": ("head_of_company_master", HeadOfCompanyMaster, "head_role_name"),
            "product-service-interests": ("product_service_interest", ProductServiceInterest, "product_service_name"),
            "account-types": ("master_account_types", MasterAccountTypes, "account_type_name"),
            "regions": ("master_account_regions", MasterAccountRegions, "region_name"),
            "business-types": ("master_business_types", MasterBusinessTypes, "business_type_name"),
            "industry-segments": ("master_industry_segments", MasterIndustrySegments, "industry_name"),
            "sub-industry-segments": ("master_sub_industry_segments", MasterSubIndustrySegments, "sub_industry_name"),
            "address-types": ("master_address_types", MasterAddressTypes, "address_type_name"),
            "countries": ("master_countries", MasterCountries, "country_name"),
            "states": ("master_states", MasterStates, "state_name"),
            "cities": ("master_cities", MasterCities, "city_name"),
            "document-types": ("master_document_types", MasterDocumentTypes, "document_type_name"),
            "currencies": ("master_currencies", MasterCurrencies, "currency_code"),
            # Lead Management Master Tables
            "lead-subtypes": ("lead_subtype_master", LeadSubtypeMaster, "lead_subtype_name"),
            "tender-subtypes": ("tender_subtype_master", TenderSubtypeMaster, "tender_subtype_name"),
            "submission-types": ("submission_type_master", SubmissionTypeMaster, "submission_type_name"),
            "clauses": ("clause_master", ClauseMaster, "clause_name"),
            "competitors": ("competitor_master", CompetitorMaster, "competitor_name"),
            "designations": ("designation_master", DesignationMaster, "designation_name"),
            "billing-types": ("billing_master", BillingMaster, "billing_type_name"),
            "lead-sources": ("lead_source_master", LeadSourceMaster, "lead_source_name")
        }
        
        mapping = table_mapping.get(table_name)
        if not mapping:
            raise HTTPException(status_code=404, detail="Master table not found")
        
        collection_name, model_class, unique_field = mapping
        collection = getattr(db, collection_name)
        
        # Check for existing record
        if unique_field in data:
            existing = await collection.find_one({unique_field: data[unique_field], "is_deleted": False})
            if existing:
                raise HTTPException(status_code=400, detail=f"{unique_field} already exists")
        
        # Create new record
        data["created_by"] = current_user.id
        data["updated_by"] = current_user.id
        new_record = model_class(**data)
        await collection.insert_one(new_record.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created {table_name}: {data.get(unique_field, 'N/A')}"))
        
        return APIResponse(success=True, message=f"{table_name} created successfully", data={"id": new_record.dict()[list(new_record.dict().keys())[0]]})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/master/{table_name}/{record_id}", response_model=APIResponse)
@require_permission("/master", "edit")
async def update_master_data(table_name: str, record_id: str, data: dict, current_user: User = Depends(get_current_user)):
    """Generic endpoint to update master table data"""
    try:
        table_mapping = {
            "job-functions": ("job_function_master", "job_function_id", "job_function_name"),
            "partner-types": ("partner_type_master", "partner_type_id", "partner_type_name"),
            "company-types": ("company_type_master", "company_type_id", "company_type_name"),
            "head-of-company": ("head_of_company_master", "head_of_company_id", "head_role_name"),
            "product-service-interests": ("product_service_interest", "product_service_id", "product_service_name"),
            "account-types": ("master_account_types", "account_type_id", "account_type_name"),
            "regions": ("master_account_regions", "region_id", "region_name"),
            "business-types": ("master_business_types", "business_type_id", "business_type_name"),
            "industry-segments": ("master_industry_segments", "industry_id", "industry_name"),
            "sub-industry-segments": ("master_sub_industry_segments", "sub_industry_id", "sub_industry_name"),
            "address-types": ("master_address_types", "address_type_id", "address_type_name"),
            "countries": ("master_countries", "country_id", "country_name"),
            "states": ("master_states", "state_id", "state_name"),
            "cities": ("master_cities", "city_id", "city_name"),
            "document-types": ("master_document_types", "document_type_id", "document_type_name"),
            "currencies": ("master_currencies", "currency_id", "currency_code"),
            # Lead Management Master Tables
            "lead-subtypes": ("lead_subtype_master", "id", "lead_subtype_name"),
            "tender-subtypes": ("tender_subtype_master", "id", "tender_subtype_name"),
            "submission-types": ("submission_type_master", "id", "submission_type_name"),
            "clauses": ("clause_master", "id", "clause_name"),
            "competitors": ("competitor_master", "id", "competitor_name"),
            "designations": ("designation_master", "id", "designation_name"),
            "billing-types": ("billing_master", "id", "billing_type_name"),
            "lead-sources": ("lead_source_master", "id", "lead_source_name")
        }
        
        mapping = table_mapping.get(table_name)
        if not mapping:
            raise HTTPException(status_code=404, detail="Master table not found")
        
        collection_name, id_field, unique_field = mapping
        collection = getattr(db, collection_name)
        
        # Check if record exists
        existing = await collection.find_one({id_field: record_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Record not found")
        
        # Check for duplicate unique field
        if unique_field in data and data[unique_field] != existing.get(unique_field):
            duplicate = await collection.find_one({unique_field: data[unique_field], "is_deleted": False})
            if duplicate and duplicate[id_field] != record_id:
                raise HTTPException(status_code=400, detail=f"{unique_field} already exists")
        
        # Update record
        data["updated_by"] = current_user.id
        data["updated_at"] = datetime.now(timezone.utc)
        
        await collection.update_one({id_field: record_id}, {"$set": data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated {table_name}: {data.get(unique_field, record_id)}"))
        
        return APIResponse(success=True, message=f"{table_name} updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/master/{table_name}/{record_id}", response_model=APIResponse)
@require_permission("/master", "delete")
async def delete_master_data(table_name: str, record_id: str, current_user: User = Depends(get_current_user)):
    """Generic endpoint to soft delete master table data"""
    try:
        table_mapping = {
            "job-functions": ("job_function_master", "job_function_id"),
            "partner-types": ("partner_type_master", "partner_type_id"),
            "company-types": ("company_type_master", "company_type_id"),
            "head-of-company": ("head_of_company_master", "head_of_company_id"),
            "product-service-interests": ("product_service_interest", "product_service_id"),
            "account-types": ("master_account_types", "account_type_id"),
            "regions": ("master_account_regions", "region_id"),
            "business-types": ("master_business_types", "business_type_id"),
            "industry-segments": ("master_industry_segments", "industry_id"),
            "sub-industry-segments": ("master_sub_industry_segments", "sub_industry_id"),
            "address-types": ("master_address_types", "address_type_id"),
            "countries": ("master_countries", "country_id"),
            "states": ("master_states", "state_id"),
            "cities": ("master_cities", "city_id"),
            "document-types": ("master_document_types", "document_type_id"),
            "currencies": ("master_currencies", "currency_id"),
            # Lead Management Master Tables
            "lead-subtypes": ("lead_subtype_master", "id"),
            "tender-subtypes": ("tender_subtype_master", "id"),
            "submission-types": ("submission_type_master", "id"),
            "clauses": ("clause_master", "id"),
            "competitors": ("competitor_master", "id"),
            "designations": ("designation_master", "id"),
            "billing-types": ("billing_master", "id"),
            "lead-sources": ("lead_source_master", "id")
        }
        
        mapping = table_mapping.get(table_name)
        if not mapping:
            raise HTTPException(status_code=404, detail="Master table not found")
        
        collection_name, id_field = mapping
        collection = getattr(db, collection_name)
        
        # Check if record exists
        existing = await collection.find_one({id_field: record_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Record not found")
        
        # Soft delete
        await collection.update_one(
            {id_field: record_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted {table_name}: {record_id}"))
        
        return APIResponse(success=True, message=f"{table_name} deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2️⃣ Partners CRUD Endpoints
@api_router.get("/partners", response_model=APIResponse)
@require_permission("/partners", "view")
async def get_partners(current_user: User = Depends(get_current_user)):
    """Get all partners with enriched company information"""
    try:
        partners = await db.partners.find({"is_deleted": False}).to_list(1000)
        
        # Enrich with master data names
        enriched_partners = []
        for partner in partners:
            partner_data = Partner(**partner).dict()
            
            # Enrich job function
            job_function = await db.job_function_master.find_one({"job_function_id": partner["job_function_id"], "is_deleted": False})
            partner_data["job_function_name"] = job_function["job_function_name"] if job_function else "Unknown"
            
            # Enrich company type
            if partner.get("company_type_id"):
                company_type = await db.company_type_master.find_one({"company_type_id": partner["company_type_id"], "is_deleted": False})
                partner_data["company_type_name"] = company_type["company_type_name"] if company_type else "Unknown"
            else:
                partner_data["company_type_name"] = None
            
            # Enrich partner type
            if partner.get("partner_type_id"):
                partner_type = await db.partner_type_master.find_one({"partner_type_id": partner["partner_type_id"], "is_deleted": False})
                partner_data["partner_type_name"] = partner_type["partner_type_name"] if partner_type else "Unknown"
            else:
                partner_data["partner_type_name"] = None
            
            # Enrich head of company
            if partner.get("head_of_company_id"):
                head_of_company = await db.head_of_company_master.find_one({"head_of_company_id": partner["head_of_company_id"], "is_deleted": False})
                partner_data["head_of_company_name"] = head_of_company["head_role_name"] if head_of_company else "Unknown"
            else:
                partner_data["head_of_company_name"] = None
            
            enriched_partners.append(partner_data)
        
        return APIResponse(success=True, message="Partners retrieved successfully", data=enriched_partners)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/partners/{partner_id}", response_model=APIResponse)
@require_permission("/partners", "view")
async def get_partner(partner_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific partner with enriched company information"""
    try:
        partner = await db.partners.find_one({"partner_id": partner_id, "is_deleted": False})
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        # Enrich with master data names
        partner_data = Partner(**partner).dict()
        
        # Enrich job function
        job_function = await db.job_function_master.find_one({"job_function_id": partner["job_function_id"], "is_deleted": False})
        partner_data["job_function_name"] = job_function["job_function_name"] if job_function else "Unknown"
        
        # Enrich company type
        if partner.get("company_type_id"):
            company_type = await db.company_type_master.find_one({"company_type_id": partner["company_type_id"], "is_deleted": False})
            partner_data["company_type_name"] = company_type["company_type_name"] if company_type else "Unknown"
        else:
            partner_data["company_type_name"] = None
        
        # Enrich partner type
        if partner.get("partner_type_id"):
            partner_type = await db.partner_type_master.find_one({"partner_type_id": partner["partner_type_id"], "is_deleted": False})
            partner_data["partner_type_name"] = partner_type["partner_type_name"] if partner_type else "Unknown"
        else:
            partner_data["partner_type_name"] = None
        
        # Enrich head of company
        if partner.get("head_of_company_id"):
            head_of_company = await db.head_of_company_master.find_one({"head_of_company_id": partner["head_of_company_id"], "is_deleted": False})
            partner_data["head_of_company_name"] = head_of_company["head_role_name"] if head_of_company else "Unknown"
        else:
            partner_data["head_of_company_name"] = None
        
        return APIResponse(success=True, message="Partner retrieved successfully", data=partner_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/partners", response_model=APIResponse)
@require_permission("/partners", "create")
async def create_partner(partner_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new partner with company information"""
    try:
        # Validate required fields
        required_fields = ["first_name", "email", "job_function_id", "company_name", "company_type_id", "partner_type_id", "head_of_company_id"]
        for field in required_fields:
            if field not in partner_data or not partner_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Validate email format
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, partner_data["email"]):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Check unique constraints
        existing_email = await db.partners.find_one({"email": partner_data["email"], "is_deleted": False})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")
        
        if partner_data.get("gst_no"):
            existing_gst = await db.partners.find_one({"gst_no": partner_data["gst_no"], "is_deleted": False})
            if existing_gst:
                raise HTTPException(status_code=400, detail="GST Number already exists")
        
        if partner_data.get("pan_no"):
            existing_pan = await db.partners.find_one({"pan_no": partner_data["pan_no"], "is_deleted": False})
            if existing_pan:
                raise HTTPException(status_code=400, detail="PAN Number already exists")
        
        # Validate master data foreign keys
        job_function = await db.job_function_master.find_one({"job_function_id": partner_data["job_function_id"], "is_deleted": False})
        if not job_function:
            raise HTTPException(status_code=400, detail="Invalid job function")
        
        company_type = await db.company_type_master.find_one({"company_type_id": partner_data["company_type_id"], "is_deleted": False})
        if not company_type:
            raise HTTPException(status_code=400, detail="Invalid company type")
        
        partner_type = await db.partner_type_master.find_one({"partner_type_id": partner_data["partner_type_id"], "is_deleted": False})
        if not partner_type:
            raise HTTPException(status_code=400, detail="Invalid partner type")
        
        head_of_company = await db.head_of_company_master.find_one({"head_of_company_id": partner_data["head_of_company_id"], "is_deleted": False})
        if not head_of_company:
            raise HTTPException(status_code=400, detail="Invalid head of company")
        
        # Validate field lengths
        if partner_data.get("gst_no") and len(partner_data["gst_no"]) > 15:
            raise HTTPException(status_code=400, detail="GST Number cannot exceed 15 characters")
        
        if partner_data.get("pan_no") and len(partner_data["pan_no"]) > 10:
            raise HTTPException(status_code=400, detail="PAN Number cannot exceed 10 characters")
        
        # Validate phone is numeric if provided
        if partner_data.get("phone") and not partner_data["phone"].isdigit():
            raise HTTPException(status_code=400, detail="Phone number must contain only digits")
        
        # Create partner
        partner_data["created_by"] = current_user.id
        partner_data["updated_by"] = current_user.id
        new_partner = Partner(**partner_data)
        await db.partners.insert_one(new_partner.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created partner: {partner_data['first_name']} {partner_data.get('last_name', '')} - {partner_data['company_name']}"))
        
        return APIResponse(success=True, message="Partner created successfully", data={"partner_id": new_partner.partner_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/partners/{partner_id}", response_model=APIResponse)
@require_permission("/partners", "edit")
async def update_partner(partner_id: str, partner_data: dict, current_user: User = Depends(get_current_user)):
    """Update a partner with company information"""
    try:
        # Check if partner exists
        existing = await db.partners.find_one({"partner_id": partner_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        # Validate email format if provided
        if "email" in partner_data:
            import re
            email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
            if not re.match(email_pattern, partner_data["email"]):
                raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Check unique constraints
        if "email" in partner_data and partner_data["email"] != existing["email"]:
            email_exists = await db.partners.find_one({"email": partner_data["email"], "is_deleted": False})
            if email_exists and email_exists["partner_id"] != partner_id:
                raise HTTPException(status_code=400, detail="Email already exists")
        
        if "gst_no" in partner_data and partner_data["gst_no"] and partner_data["gst_no"] != existing.get("gst_no"):
            gst_exists = await db.partners.find_one({"gst_no": partner_data["gst_no"], "is_deleted": False})
            if gst_exists and gst_exists["partner_id"] != partner_id:
                raise HTTPException(status_code=400, detail="GST Number already exists")
        
        if "pan_no" in partner_data and partner_data["pan_no"] and partner_data["pan_no"] != existing.get("pan_no"):
            pan_exists = await db.partners.find_one({"pan_no": partner_data["pan_no"], "is_deleted": False})
            if pan_exists and pan_exists["partner_id"] != partner_id:
                raise HTTPException(status_code=400, detail="PAN Number already exists")
        
        # Validate master data foreign keys if provided
        if "job_function_id" in partner_data:
            job_function = await db.job_function_master.find_one({"job_function_id": partner_data["job_function_id"], "is_deleted": False})
            if not job_function:
                raise HTTPException(status_code=400, detail="Invalid job function")
        
        if "company_type_id" in partner_data:
            company_type = await db.company_type_master.find_one({"company_type_id": partner_data["company_type_id"], "is_deleted": False})
            if not company_type:
                raise HTTPException(status_code=400, detail="Invalid company type")
        
        if "partner_type_id" in partner_data:
            partner_type = await db.partner_type_master.find_one({"partner_type_id": partner_data["partner_type_id"], "is_deleted": False})
            if not partner_type:
                raise HTTPException(status_code=400, detail="Invalid partner type")
        
        if "head_of_company_id" in partner_data:
            head_of_company = await db.head_of_company_master.find_one({"head_of_company_id": partner_data["head_of_company_id"], "is_deleted": False})
            if not head_of_company:
                raise HTTPException(status_code=400, detail="Invalid head of company")
        
        # Validate field lengths
        if "gst_no" in partner_data and partner_data["gst_no"] and len(partner_data["gst_no"]) > 15:
            raise HTTPException(status_code=400, detail="GST Number cannot exceed 15 characters")
        
        if "pan_no" in partner_data and partner_data["pan_no"] and len(partner_data["pan_no"]) > 10:
            raise HTTPException(status_code=400, detail="PAN Number cannot exceed 10 characters")
        
        # Validate phone is numeric if provided
        if "phone" in partner_data and partner_data["phone"] and not partner_data["phone"].isdigit():
            raise HTTPException(status_code=400, detail="Phone number must contain only digits")
        
        # Update partner
        partner_data["updated_by"] = current_user.id
        partner_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.partners.update_one({"partner_id": partner_id}, {"$set": partner_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated partner: {partner_id}"))
        
        return APIResponse(success=True, message="Partner updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/partners/{partner_id}", response_model=APIResponse)
@require_permission("/partners", "delete")
async def delete_partner(partner_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a partner"""
    try:
        # Check if partner exists
        existing = await db.partners.find_one({"partner_id": partner_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        # Soft delete
        await db.partners.update_one(
            {"partner_id": partner_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted partner: {partner_id}"))
        
        return APIResponse(success=True, message="Partner deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3️⃣ Companies CRUD Endpoints
@api_router.get("/companies", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_companies(current_user: User = Depends(get_current_user)):
    """Get all companies with enriched master data"""
    try:
        companies = await db.companies.find({"is_deleted": False}).to_list(1000)
        
        # Enrich with master data names
        enriched_companies = []
        for company in companies:
            company_data = Company(**company).dict()
            
            # Get company type name
            company_type = await db.company_type_master.find_one({"company_type_id": company["company_type_id"], "is_deleted": False})
            company_data["company_type_name"] = company_type["company_type_name"] if company_type else "Unknown"
            
            # Get partner type name
            partner_type = await db.partner_type_master.find_one({"partner_type_id": company["partner_type_id"], "is_deleted": False})
            company_data["partner_type_name"] = partner_type["partner_type_name"] if partner_type else "Unknown"
            
            # Get head of company name
            head_of_company = await db.head_of_company_master.find_one({"head_of_company_id": company["head_of_company_id"], "is_deleted": False})
            company_data["head_of_company_name"] = head_of_company["head_role_name"] if head_of_company else "Unknown"
            
            # Get counts of nested entities
            company_data["addresses_count"] = await db.company_addresses.count_documents({"company_id": company["company_id"], "is_deleted": False})
            company_data["documents_count"] = await db.company_documents.count_documents({"company_id": company["company_id"], "is_deleted": False})
            company_data["financials_count"] = await db.company_financials.count_documents({"company_id": company["company_id"], "is_deleted": False})
            company_data["contacts_count"] = await db.contacts.count_documents({"company_id": company["company_id"], "is_deleted": False})
            
            enriched_companies.append(company_data)
        
        return APIResponse(success=True, message="Companies retrieved successfully", data=enriched_companies)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/companies", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_company(company_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new company"""
    try:
        # Validate required fields
        required_fields = ["company_name", "company_type_id", "partner_type_id", "head_of_company_id"]
        for field in required_fields:
            if field not in company_data or not company_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Check if GST number already exists (if provided)
        if "gst_no" in company_data and company_data["gst_no"]:
            existing_gst = await db.companies.find_one({"gst_no": company_data["gst_no"], "is_deleted": False})
            if existing_gst:
                raise HTTPException(status_code=400, detail="GST number already exists")
        
        # Check if PAN number already exists (if provided)
        if "pan_no" in company_data and company_data["pan_no"]:
            existing_pan = await db.companies.find_one({"pan_no": company_data["pan_no"], "is_deleted": False})
            if existing_pan:
                raise HTTPException(status_code=400, detail="PAN number already exists")
        
        # Validate foreign keys
        fk_validations = [
            ("company_type_id", db.company_type_master, "company_type_id"),
            ("partner_type_id", db.partner_type_master, "partner_type_id"),
            ("head_of_company_id", db.head_of_company_master, "head_of_company_id")
        ]
        
        for field, collection, id_field in fk_validations:
            if field in company_data:
                exists = await collection.find_one({id_field: company_data[field], "is_deleted": False})
                if not exists:
                    raise HTTPException(status_code=400, detail=f"Invalid {field}")
        
        # Create company
        company_data["created_by"] = current_user.id
        company_data["updated_by"] = current_user.id
        new_company = Company(**company_data)
        await db.companies.insert_one(new_company.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created company: {company_data['company_name']}"))
        
        return APIResponse(success=True, message="Company created successfully", data={"company_id": new_company.company_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/companies/{company_id}", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_company(company_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific company with all related data"""
    try:
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Enrich with master data names
        company_data = Company(**company).dict()
        
        # Get company type name
        company_type = await db.company_type_master.find_one({"company_type_id": company["company_type_id"], "is_deleted": False})
        company_data["company_type_name"] = company_type["company_type_name"] if company_type else "Unknown"
        
        # Get partner type name
        partner_type = await db.partner_type_master.find_one({"partner_type_id": company["partner_type_id"], "is_deleted": False})
        company_data["partner_type_name"] = partner_type["partner_type_name"] if partner_type else "Unknown"
        
        # Get head of company name
        head_of_company = await db.head_of_company_master.find_one({"head_of_company_id": company["head_of_company_id"], "is_deleted": False})
        company_data["head_of_company_name"] = head_of_company["head_role_name"] if head_of_company else "Unknown"
        
        # Get related data with enrichment
        addresses = await db.company_addresses.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_addresses = []
        for addr in addresses:
            addr_data = CompanyAddress(**addr).dict()
            # Enrich with location names
            country = await db.master_countries.find_one({"country_id": addr["country_id"], "is_deleted": False})
            state = await db.master_states.find_one({"state_id": addr["state_id"], "is_deleted": False})
            city = await db.master_cities.find_one({"city_id": addr["city_id"], "is_deleted": False})
            addr_type = await db.master_address_types.find_one({"address_type_id": addr["address_type_id"], "is_deleted": False})
            
            addr_data["country_name"] = country["country_name"] if country else "Unknown"
            addr_data["state_name"] = state["state_name"] if state else "Unknown"
            addr_data["city_name"] = city["city_name"] if city else "Unknown"
            addr_data["address_type_name"] = addr_type["address_type_name"] if addr_type else "Unknown"
            enriched_addresses.append(addr_data)
        
        documents = await db.company_documents.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_documents = []
        for doc in documents:
            doc_data = CompanyDocument(**doc).dict()
            doc_type = await db.master_document_types.find_one({"document_type_id": doc["document_type_id"], "is_deleted": False})
            doc_data["document_type_name"] = doc_type["document_type_name"] if doc_type else "Unknown"
            enriched_documents.append(doc_data)
        
        financials = await db.company_financials.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_financials = []
        for fin in financials:
            fin_data = CompanyFinancial(**fin).dict()
            currency = await db.master_currencies.find_one({"currency_id": fin["currency_id"], "is_deleted": False})
            fin_data["currency_name"] = currency["currency_name"] if currency else "Unknown"
            fin_data["currency_symbol"] = currency["symbol"] if currency else ""
            enriched_financials.append(fin_data)
        
        contacts = await db.contacts.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_contacts = []
        for contact in contacts:
            contact_data = Contact(**contact).dict()
            if contact.get("designation_id"):
                designation = await db.job_function_master.find_one({"job_function_id": contact["designation_id"], "is_deleted": False})
                contact_data["designation_name"] = designation["job_function_name"] if designation else "Unknown"
            else:
                contact_data["designation_name"] = None
            enriched_contacts.append(contact_data)
        
        company_data["addresses"] = enriched_addresses
        company_data["documents"] = enriched_documents
        company_data["financials"] = enriched_financials
        company_data["contacts"] = enriched_contacts
        
        return APIResponse(success=True, message="Company retrieved successfully", data=company_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/companies/{company_id}", response_model=APIResponse)
@require_permission("/companies", "edit")
async def update_company(company_id: str, company_data: dict, current_user: User = Depends(get_current_user)):
    """Update a company"""
    try:
        # Check if company exists
        existing = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Check GST uniqueness if GST is being updated
        if "gst_no" in company_data and company_data["gst_no"] and company_data["gst_no"] != existing.get("gst_no"):
            gst_exists = await db.companies.find_one({"gst_no": company_data["gst_no"], "is_deleted": False})
            if gst_exists and gst_exists["company_id"] != company_id:
                raise HTTPException(status_code=400, detail="GST number already exists")
        
        # Check PAN uniqueness if PAN is being updated
        if "pan_no" in company_data and company_data["pan_no"] and company_data["pan_no"] != existing.get("pan_no"):
            pan_exists = await db.companies.find_one({"pan_no": company_data["pan_no"], "is_deleted": False})
            if pan_exists and pan_exists["company_id"] != company_id:
                raise HTTPException(status_code=400, detail="PAN number already exists")
        
        # Validate foreign keys if provided
        fk_validations = [
            ("company_type_id", db.company_type_master, "company_type_id"),
            ("partner_type_id", db.partner_type_master, "partner_type_id"),
            ("head_of_company_id", db.head_of_company_master, "head_of_company_id")
        ]
        
        for field, collection, id_field in fk_validations:
            if field in company_data:
                exists = await collection.find_one({id_field: company_data[field], "is_deleted": False})
                if not exists:
                    raise HTTPException(status_code=400, detail=f"Invalid {field}")
        
        # Update company
        company_data["updated_by"] = current_user.id
        company_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.companies.update_one({"company_id": company_id}, {"$set": company_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated company: {company_id}"))
        
        return APIResponse(success=True, message="Company updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/companies/{company_id}", response_model=APIResponse)
@require_permission("/companies", "delete")
async def delete_company(company_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a company and all related data"""
    try:
        # Check if company exists
        existing = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Soft delete company
        await db.companies.update_one(
            {"company_id": company_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Soft delete related data
        related_collections = [
            ("company_addresses", "company_id"),
            ("company_documents", "company_id"),
            ("company_financials", "company_id"),
            ("contacts", "company_id")
        ]
        
        for collection_name, field_name in related_collections:
            collection = getattr(db, collection_name)
            await collection.update_many(
                {field_name: company_id},
                {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
            )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted company and related data: {company_id}"))
        
        return APIResponse(success=True, message="Company and related data deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4️⃣ Company Addresses CRUD Endpoints
@api_router.get("/companies/{company_id}/addresses", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_company_addresses(company_id: str, current_user: User = Depends(get_current_user)):
    """Get all addresses for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        addresses = await db.company_addresses.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_addresses = []
        
        for addr in addresses:
            addr_data = CompanyAddress(**addr).dict()
            # Enrich with location names
            country = await db.master_countries.find_one({"country_id": addr["country_id"], "is_deleted": False})
            state = await db.master_states.find_one({"state_id": addr["state_id"], "is_deleted": False})
            city = await db.master_cities.find_one({"city_id": addr["city_id"], "is_deleted": False})
            addr_type = await db.master_address_types.find_one({"address_type_id": addr["address_type_id"], "is_deleted": False})
            
            addr_data["country_name"] = country["country_name"] if country else "Unknown"
            addr_data["state_name"] = state["state_name"] if state else "Unknown"
            addr_data["city_name"] = city["city_name"] if city else "Unknown"
            addr_data["address_type_name"] = addr_type["address_type_name"] if addr_type else "Unknown"
            enriched_addresses.append(addr_data)
        
        return APIResponse(success=True, message="Company addresses retrieved successfully", data=enriched_addresses)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/companies/{company_id}/addresses", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_company_address(company_id: str, address_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new address for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Validate required fields
        required_fields = ["address", "country_id", "state_id", "city_id", "address_type_id"]
        for field in required_fields:
            if field not in address_data or not address_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Validate foreign keys
        fk_validations = [
            ("country_id", db.master_countries, "country_id"),
            ("state_id", db.master_states, "state_id"),
            ("city_id", db.master_cities, "city_id"),
            ("address_type_id", db.master_address_types, "address_type_id")
        ]
        
        for field, collection, id_field in fk_validations:
            exists = await collection.find_one({id_field: address_data[field], "is_deleted": False})
            if not exists:
                raise HTTPException(status_code=400, detail=f"Invalid {field}")
        
        # Create address
        address_data["company_id"] = company_id
        address_data["created_by"] = current_user.id
        address_data["updated_by"] = current_user.id
        new_address = CompanyAddress(**address_data)
        await db.company_addresses.insert_one(new_address.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created address for company: {company_id}"))
        
        return APIResponse(success=True, message="Company address created successfully", data={"address_id": new_address.address_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/companies/{company_id}/addresses/{address_id}", response_model=APIResponse)
@require_permission("/companies", "edit")
async def update_company_address(company_id: str, address_id: str, address_data: dict, current_user: User = Depends(get_current_user)):
    """Update a company address"""
    try:
        # Check if address exists and belongs to company
        existing = await db.company_addresses.find_one({"address_id": address_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Address not found")
        
        # Validate foreign keys if provided
        fk_validations = [
            ("country_id", db.master_countries, "country_id"),
            ("state_id", db.master_states, "state_id"),
            ("city_id", db.master_cities, "city_id"),
            ("address_type_id", db.master_address_types, "address_type_id")
        ]
        
        for field, collection, id_field in fk_validations:
            if field in address_data:
                exists = await collection.find_one({id_field: address_data[field], "is_deleted": False})
                if not exists:
                    raise HTTPException(status_code=400, detail=f"Invalid {field}")
        
        # Update address
        address_data["updated_by"] = current_user.id
        address_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.company_addresses.update_one({"address_id": address_id}, {"$set": address_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated address for company: {company_id}"))
        
        return APIResponse(success=True, message="Company address updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/companies/{company_id}/addresses/{address_id}", response_model=APIResponse)
@require_permission("/companies", "delete")
async def delete_company_address(company_id: str, address_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a company address"""
    try:
        # Check if address exists and belongs to company
        existing = await db.company_addresses.find_one({"address_id": address_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Address not found")
        
        # Soft delete
        await db.company_addresses.update_one(
            {"address_id": address_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted address for company: {company_id}"))
        
        return APIResponse(success=True, message="Company address deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5️⃣ Company Documents CRUD Endpoints
@api_router.get("/companies/{company_id}/documents", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_company_documents(company_id: str, current_user: User = Depends(get_current_user)):
    """Get all documents for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        documents = await db.company_documents.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_documents = []
        
        for doc in documents:
            doc_data = CompanyDocument(**doc).dict()
            doc_type = await db.master_document_types.find_one({"document_type_id": doc["document_type_id"], "is_deleted": False})
            doc_data["document_type_name"] = doc_type["document_type_name"] if doc_type else "Unknown"
            enriched_documents.append(doc_data)
        
        return APIResponse(success=True, message="Company documents retrieved successfully", data=enriched_documents)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/companies/{company_id}/documents", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_company_document(company_id: str, document_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new document for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Validate required fields
        required_fields = ["document_type_id", "file_path"]
        for field in required_fields:
            if field not in document_data or not document_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Validate document type
        doc_type = await db.master_document_types.find_one({"document_type_id": document_data["document_type_id"], "is_deleted": False})
        if not doc_type:
            raise HTTPException(status_code=400, detail="Invalid document_type_id")
        
        # Create document
        document_data["company_id"] = company_id
        document_data["created_by"] = current_user.id
        document_data["updated_by"] = current_user.id
        new_document = CompanyDocument(**document_data)
        await db.company_documents.insert_one(new_document.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Added document for company: {company_id}"))
        
        return APIResponse(success=True, message="Company document created successfully", data={"document_id": new_document.document_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/companies/{company_id}/documents/{document_id}", response_model=APIResponse)
@require_permission("/companies", "edit")
async def update_company_document(company_id: str, document_id: str, document_data: dict, current_user: User = Depends(get_current_user)):
    """Update a company document"""
    try:
        # Check if document exists and belongs to company
        existing = await db.company_documents.find_one({"document_id": document_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Validate document type if provided
        if "document_type_id" in document_data:
            doc_type = await db.master_document_types.find_one({"document_type_id": document_data["document_type_id"], "is_deleted": False})
            if not doc_type:
                raise HTTPException(status_code=400, detail="Invalid document_type_id")
        
        # Update document
        document_data["updated_by"] = current_user.id
        document_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.company_documents.update_one({"document_id": document_id}, {"$set": document_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated document for company: {company_id}"))
        
        return APIResponse(success=True, message="Company document updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/companies/{company_id}/documents/{document_id}", response_model=APIResponse)
@require_permission("/companies", "delete")
async def delete_company_document(company_id: str, document_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a company document"""
    try:
        # Check if document exists and belongs to company
        existing = await db.company_documents.find_one({"document_id": document_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Soft delete
        await db.company_documents.update_one(
            {"document_id": document_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted document for company: {company_id}"))
        
        return APIResponse(success=True, message="Company document deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6️⃣ Company Financials CRUD Endpoints
@api_router.get("/companies/{company_id}/financials", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_company_financials(company_id: str, current_user: User = Depends(get_current_user)):
    """Get all financials for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        financials = await db.company_financials.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_financials = []
        
        for fin in financials:
            fin_data = CompanyFinancial(**fin).dict()
            currency = await db.master_currencies.find_one({"currency_id": fin["currency_id"], "is_deleted": False})
            fin_data["currency_name"] = currency["currency_name"] if currency else "Unknown"
            fin_data["currency_symbol"] = currency["symbol"] if currency else ""
            fin_data["currency_code"] = currency["currency_code"] if currency else ""
            enriched_financials.append(fin_data)
        
        return APIResponse(success=True, message="Company financials retrieved successfully", data=enriched_financials)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/companies/{company_id}/financials", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_company_financial(company_id: str, financial_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new financial record for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Validate required fields
        required_fields = ["year", "currency_id", "type"]
        for field in required_fields:
            if field not in financial_data or not financial_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Validate year (must be reasonable)
        year = financial_data["year"]
        if not isinstance(year, int) or year < 1900 or year > 2100:
            raise HTTPException(status_code=400, detail="Invalid year")
        
        # Validate positive numeric values
        if "revenue" in financial_data and financial_data["revenue"] is not None:
            if not isinstance(financial_data["revenue"], (int, float)) or financial_data["revenue"] < 0:
                raise HTTPException(status_code=400, detail="Revenue must be a positive number")
        
        if "profit" in financial_data and financial_data["profit"] is not None:
            if not isinstance(financial_data["profit"], (int, float)):
                raise HTTPException(status_code=400, detail="Profit must be a number")
        
        # Validate currency
        currency = await db.master_currencies.find_one({"currency_id": financial_data["currency_id"], "is_deleted": False})
        if not currency:
            raise HTTPException(status_code=400, detail="Invalid currency_id")
        
        # Check for duplicate year + type combination
        existing = await db.company_financials.find_one({
            "company_id": company_id,
            "year": year,
            "type": financial_data["type"],
            "is_deleted": False
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Financial record for year {year} and type '{financial_data['type']}' already exists")
        
        # Create financial record
        financial_data["company_id"] = company_id
        financial_data["created_by"] = current_user.id
        financial_data["updated_by"] = current_user.id
        new_financial = CompanyFinancial(**financial_data)
        await db.company_financials.insert_one(new_financial.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Added financial record for company: {company_id}"))
        
        return APIResponse(success=True, message="Company financial record created successfully", data={"financial_id": new_financial.financial_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/companies/{company_id}/financials/{financial_id}", response_model=APIResponse)
@require_permission("/companies", "edit")
async def update_company_financial(company_id: str, financial_id: str, financial_data: dict, current_user: User = Depends(get_current_user)):
    """Update a company financial record"""
    try:
        # Check if financial record exists and belongs to company
        existing = await db.company_financials.find_one({"financial_id": financial_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Financial record not found")
        
        # Validate year if provided
        if "year" in financial_data:
            year = financial_data["year"]
            if not isinstance(year, int) or year < 1900 or year > 2100:
                raise HTTPException(status_code=400, detail="Invalid year")
            
            # Check for duplicate year + type combination
            type_value = financial_data.get("type", existing.get("type"))
            duplicate = await db.company_financials.find_one({
                "company_id": company_id,
                "year": year,
                "type": type_value,
                "financial_id": {"$ne": financial_id},
                "is_deleted": False
            })
            if duplicate:
                raise HTTPException(status_code=400, detail=f"Financial record for year {year} and type '{type_value}' already exists")
        
        # Validate numeric values
        if "revenue" in financial_data and financial_data["revenue"] is not None:
            if not isinstance(financial_data["revenue"], (int, float)) or financial_data["revenue"] < 0:
                raise HTTPException(status_code=400, detail="Revenue must be a positive number")
        
        if "profit" in financial_data and financial_data["profit"] is not None:
            if not isinstance(financial_data["profit"], (int, float)):
                raise HTTPException(status_code=400, detail="Profit must be a number")
        
        # Validate currency if provided
        if "currency_id" in financial_data:
            currency = await db.master_currencies.find_one({"currency_id": financial_data["currency_id"], "is_deleted": False})
            if not currency:
                raise HTTPException(status_code=400, detail="Invalid currency_id")
        
        # Update financial record
        financial_data["updated_by"] = current_user.id
        financial_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.company_financials.update_one({"financial_id": financial_id}, {"$set": financial_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated financial record for company: {company_id}"))
        
        return APIResponse(success=True, message="Company financial record updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/companies/{company_id}/financials/{financial_id}", response_model=APIResponse)
@require_permission("/companies", "delete")
async def delete_company_financial(company_id: str, financial_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a company financial record"""
    try:
        # Check if financial record exists and belongs to company
        existing = await db.company_financials.find_one({"financial_id": financial_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Financial record not found")
        
        # Soft delete
        await db.company_financials.update_one(
            {"financial_id": financial_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted financial record for company: {company_id}"))
        
        return APIResponse(success=True, message="Company financial record deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 7️⃣ Company Contacts CRUD Endpoints
@api_router.get("/companies/{company_id}/contacts", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_company_contacts(company_id: str, current_user: User = Depends(get_current_user)):
    """Get all contacts for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        contacts = await db.contacts.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        enriched_contacts = []
        
        for contact in contacts:
            contact_data = Contact(**contact).dict()
            if contact.get("designation_id"):
                designation = await db.job_function_master.find_one({"job_function_id": contact["designation_id"], "is_deleted": False})
                contact_data["designation_name"] = designation["job_function_name"] if designation else "Unknown"
            else:
                contact_data["designation_name"] = None
            enriched_contacts.append(contact_data)
        
        return APIResponse(success=True, message="Company contacts retrieved successfully", data=enriched_contacts)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/companies/{company_id}/contacts", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_company_contact(company_id: str, contact_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new contact for a company"""
    try:
        # Check if company exists
        company = await db.companies.find_one({"company_id": company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Validate required fields
        required_fields = ["first_name", "last_name", "email"]
        for field in required_fields:
            if field not in contact_data or not contact_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Check if email already exists for this company
        existing_email = await db.contacts.find_one({
            "company_id": company_id,
            "email": contact_data["email"],
            "is_deleted": False
        })
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists for this company")
        
        # Validate designation if provided
        if "designation_id" in contact_data and contact_data["designation_id"]:
            designation = await db.job_function_master.find_one({"job_function_id": contact_data["designation_id"], "is_deleted": False})
            if not designation:
                raise HTTPException(status_code=400, detail="Invalid designation_id")
        
        # If setting as primary contact, ensure no other primary contact exists
        if contact_data.get("is_primary"):
            existing_primary = await db.contacts.find_one({
                "company_id": company_id,
                "is_primary": True,
                "is_deleted": False
            })
            if existing_primary:
                # Unset existing primary contact
                await db.contacts.update_one(
                    {"contact_id": existing_primary["contact_id"]},
                    {"$set": {"is_primary": False, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
                )
        
        # Create contact
        contact_data["company_id"] = company_id
        contact_data["created_by"] = current_user.id
        contact_data["updated_by"] = current_user.id
        new_contact = Contact(**contact_data)
        await db.contacts.insert_one(new_contact.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Added contact for company: {company_id}"))
        
        return APIResponse(success=True, message="Company contact created successfully", data={"contact_id": new_contact.contact_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/companies/{company_id}/contacts/{contact_id}", response_model=APIResponse)
@require_permission("/companies", "edit")
async def update_company_contact(company_id: str, contact_id: str, contact_data: dict, current_user: User = Depends(get_current_user)):
    """Update a company contact"""
    try:
        # Check if contact exists and belongs to company
        existing = await db.contacts.find_one({"contact_id": contact_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Check email uniqueness if email is being updated
        if "email" in contact_data and contact_data["email"] != existing["email"]:
            email_exists = await db.contacts.find_one({
                "company_id": company_id,
                "email": contact_data["email"],
                "contact_id": {"$ne": contact_id},
                "is_deleted": False
            })
            if email_exists:
                raise HTTPException(status_code=400, detail="Email already exists for this company")
        
        # Validate designation if provided
        if "designation_id" in contact_data and contact_data["designation_id"]:
            designation = await db.job_function_master.find_one({"job_function_id": contact_data["designation_id"], "is_deleted": False})
            if not designation:
                raise HTTPException(status_code=400, detail="Invalid designation_id")
        
        # Handle primary contact logic
        if contact_data.get("is_primary") and not existing.get("is_primary"):
            # Setting as primary - unset any existing primary contact
            await db.contacts.update_many(
                {"company_id": company_id, "is_primary": True, "contact_id": {"$ne": contact_id}, "is_deleted": False},
                {"$set": {"is_primary": False, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
            )
        
        # Update contact
        contact_data["updated_by"] = current_user.id
        contact_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.contacts.update_one({"contact_id": contact_id}, {"$set": contact_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated contact for company: {company_id}"))
        
        return APIResponse(success=True, message="Company contact updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/companies/{company_id}/contacts/{contact_id}", response_model=APIResponse)
@require_permission("/companies", "delete")
async def delete_company_contact(company_id: str, contact_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a company contact"""
    try:
        # Check if contact exists and belongs to company
        existing = await db.contacts.find_one({"contact_id": contact_id, "company_id": company_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Soft delete
        await db.contacts.update_one(
            {"contact_id": contact_id},
            {"$set": {"is_deleted": True, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted contact for company: {company_id}"))
        
        return APIResponse(success=True, message="Company contact deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PHASE 4: GOVERNANCE & REPORTING MODELS =====

# Advanced Analytics and KPI Tracking
class OpportunityAnalytics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Time Period
    analytics_period: str  # daily, weekly, monthly, quarterly, yearly
    period_start: datetime
    period_end: datetime
    
    # Opportunity Metrics
    total_opportunities: int = 0
    new_opportunities: int = 0
    closed_opportunities: int = 0
    won_opportunities: int = 0
    lost_opportunities: int = 0
    
    # Revenue Metrics
    total_pipeline_value: float = 0.0
    won_revenue: float = 0.0
    lost_revenue: float = 0.0
    average_deal_size: float = 0.0
    
    # Performance Metrics
    win_rate: float = 0.0  # Percentage
    loss_rate: float = 0.0  # Percentage
    conversion_rate: float = 0.0  # Lead to Opportunity
    average_sales_cycle: int = 0  # Days
    
    # Stage Metrics
    stage_distribution: Optional[str] = None  # JSON of opportunities per stage
    stage_conversion_rates: Optional[str] = None  # JSON of stage-to-stage conversion
    
    # Team Performance
    top_performers: Optional[str] = None  # JSON of top performing users
    team_metrics: Optional[str] = None  # JSON of team-wise performance
    
    # Qualification Metrics
    qualification_completion_rate: float = 0.0
    average_qualification_time: int = 0  # Days
    
    # Currency
    base_currency: str = "INR"
    
    # Generated timestamp
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    generated_by: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Enhanced Audit Trails
class OpportunityAuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Reference Information
    opportunity_id: str
    entity_type: str  # opportunity, document, clause, contact, stage, qualification
    entity_id: Optional[str] = None  # ID of the specific entity being audited
    
    # Action Details
    action_type: str  # create, update, delete, approve, reject, transition, view
    action_description: str
    
    # Field-level Changes
    field_changes: Optional[str] = None  # JSON of before/after values
    previous_values: Optional[str] = None  # JSON of previous state
    new_values: Optional[str] = None  # JSON of new state
    
    # User and Session Information
    user_id: str
    user_role: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    # Business Context
    business_justification: Optional[str] = None
    approval_required: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Risk and Compliance
    risk_level: str = "low"  # low, medium, high, critical
    compliance_flags: Optional[str] = None  # JSON of compliance concerns
    
    # Timestamp
    action_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # System Information
    system_version: Optional[str] = None
    api_endpoint: Optional[str] = None

# Performance Metrics and KPIs
class OpportunityKPI(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # KPI Definition
    kpi_name: str
    kpi_code: str  # WIN_RATE, CONVERSION_RATE, CYCLE_TIME, etc.
    kpi_category: str  # performance, quality, efficiency, compliance
    kpi_description: str
    
    # Measurement
    measurement_period: str  # daily, weekly, monthly, quarterly, yearly
    target_value: float
    actual_value: float
    variance: float = 0.0  # actual - target
    variance_percentage: float = 0.0  # (actual - target) / target * 100
    
    # Performance Status
    performance_status: str = "on_track"  # on_track, at_risk, critical, exceeded
    trend: str = "stable"  # improving, stable, declining
    
    # Business Impact
    business_impact: str = "medium"  # low, medium, high, critical
    action_required: bool = False
    recommended_actions: Optional[str] = None
    
    # Time Period
    period_start: datetime
    period_end: datetime
    
    # Context Information
    owner_id: Optional[str] = None  # User responsible for this KPI
    department: Optional[str] = None
    team: Optional[str] = None
    
    # Calculation Details
    calculation_method: Optional[str] = None
    data_sources: Optional[str] = None  # JSON of data sources used
    
    # Audit Fields
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    calculated_by: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Compliance Monitoring
class OpportunityCompliance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Reference
    opportunity_id: str
    compliance_type: str  # regulatory, internal_policy, quality, security
    compliance_rule: str
    compliance_description: str
    
    # Compliance Status
    compliance_status: str = "pending"  # compliant, non_compliant, partial, pending, exempted
    compliance_score: float = 0.0  # 0-100
    
    # Assessment Details
    assessed_by: Optional[str] = None
    assessed_at: Optional[datetime] = None
    assessment_notes: Optional[str] = None
    evidence_documents: Optional[str] = None  # JSON array of document IDs
    
    # Risk Assessment
    risk_level: str = "low"  # low, medium, high, critical
    risk_description: Optional[str] = None
    mitigation_actions: Optional[str] = None
    
    # Remediation
    remediation_required: bool = False
    remediation_plan: Optional[str] = None
    remediation_deadline: Optional[datetime] = None
    remediation_status: str = "not_required"  # not_required, planned, in_progress, completed
    
    # Approval and Sign-off
    requires_approval: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_comments: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Digital Signature Tracking
class OpportunityDigitalSignature(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Document Reference
    opportunity_id: str
    document_id: Optional[str] = None  # Reference to OpportunityDocument
    document_type: str  # quotation, contract, agreement, nda
    document_name: str
    
    # Signature Details
    signature_type: str = "digital"  # digital, electronic, wet_signature
    signature_method: str  # certificate, otp, biometric, pin
    
    # Signer Information
    signer_id: str  # User ID
    signer_name: str
    signer_email: str
    signer_role: str
    signer_authority: str  # what authority does the signer have
    
    # Signature Metadata
    signature_hash: Optional[str] = None  # Cryptographic hash
    certificate_id: Optional[str] = None  # Digital certificate ID
    signature_image_path: Optional[str] = None  # Path to signature image
    
    # Timestamp and Location
    signed_at: datetime
    signature_timezone: str = "UTC"
    location: Optional[str] = None
    ip_address: Optional[str] = None
    
    # Verification
    is_verified: bool = False
    verification_method: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    
    # Legal Validity
    legal_status: str = "valid"  # valid, invalid, expired, revoked
    expiry_date: Optional[datetime] = None
    
    # Audit Fields
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ===== PHASE 3: ADVANCED FEATURES MODELS =====

# Opportunity Documents (Form 5 requirement)
class OpportunityDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Document Information
    document_name: str
    document_type_id: str  # Reference to MasterDocumentTypes
    version: str = "1.0"  # Version control
    file_path: str
    file_size: Optional[int] = None  # File size in bytes
    file_format: Optional[str] = None  # PDF, DOC, XLS, etc.
    
    # Document Management
    is_final_version: bool = False  # Final versions are read-only
    document_status: str = "draft"  # draft, review, approved, final
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Access Control
    access_level: str = "internal"  # internal, confidential, public
    can_download: bool = True
    can_edit: bool = True
    
    # Document Description
    document_description: Optional[str] = None
    tags: Optional[str] = None  # Comma-separated tags
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('document_name')
    def validate_document_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Document name is required')
        return v.strip()
    
    @validator('version')
    def validate_version(cls, v):
        # Version format validation (e.g., 1.0, 2.1, etc.)
        import re
        if not re.match(r'^\d+\.\d+$', v):
            raise ValueError('Version must be in format X.Y (e.g., 1.0, 2.1)')
        return v

# Opportunity Clauses (Form 6 requirement)  
class OpportunityClause(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Clause Information
    clause_type: str  # Payment Terms, Delivery Terms, SLA, Penalties, etc.
    criteria_description: str
    clause_value: Optional[str] = None  # Specific value or amount
    
    # Compliance Status
    is_compliant: bool = False  # Y/N compliance
    compliance_notes: Optional[str] = None
    evidence_document_id: Optional[str] = None  # Link to OpportunityDocument
    
    # Review Status
    review_status: str = "pending"  # pending, reviewed, approved
    reviewed_by: Optional[str] = None  # GC/Legal role
    reviewed_at: Optional[datetime] = None
    review_comments: Optional[str] = None
    
    # Priority and Impact
    priority_level: str = "medium"  # low, medium, high, critical
    business_impact: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Important Dates for Tender (Form 4 requirement)
class OpportunityImportantDate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Date Information
    date_type: str  # Tender Publish, Query Submission, Pre-Bid, Submission, Tech Opening, Presentation
    date_value: datetime
    time_value: Optional[str] = None  # Time if specific time is important
    
    # Date Details
    description: Optional[str] = None
    location: Optional[str] = None  # For meetings/presentations
    attendees: Optional[str] = None  # JSON array of attendee user IDs
    
    # Status Tracking
    date_status: str = "scheduled"  # scheduled, completed, missed, cancelled
    completion_notes: Optional[str] = None
    actual_date: Optional[datetime] = None  # If different from planned
    
    # Reminders
    reminder_days: Optional[int] = None  # Days before to send reminder
    reminder_sent: bool = False
    reminder_sent_at: Optional[datetime] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('date_type')
    def validate_date_type(cls, v):
        valid_types = [
            'Tender Publish', 'Query Submission', 'Pre-Bid Meeting', 'Bid Submission',
            'Technical Opening', 'Financial Opening', 'Presentation', 'Award Announcement',
            'Contract Signing', 'Project Kickoff'
        ]
        if v not in valid_types:
            raise ValueError(f'Date type must be one of: {", ".join(valid_types)}')
        return v

# Won Details (Form 5 requirement)
class OpportunityWonDetails(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Quotation Information
    quotation_id: str  # Unique quotation ID
    quotation_name: str
    quotation_date: datetime
    quotation_validity: Optional[datetime] = None
    
    # Financial Details
    otc_price: float = 0.0  # One Time Cost
    recurring_price: float = 0.0  # Recurring price (monthly/yearly)
    total_contract_value: float = 0.0
    currency_id: str
    
    # Purchase Order Details
    po_number: Optional[str] = None
    po_amount: Optional[float] = None
    po_date: Optional[datetime] = None
    po_validity: Optional[datetime] = None
    
    # Profitability Analysis
    cost_breakdown: Optional[str] = None  # JSON structure
    gross_margin: Optional[float] = None  # Percentage
    net_margin: Optional[float] = None  # Percentage
    profitability_status: str = "pending"  # pending, approved, rejected
    min_margin_compliance: bool = False  # Min 9% margin check
    
    # Payment Terms
    payment_terms: Optional[str] = None
    payment_schedule: Optional[str] = None  # JSON structure
    advance_payment: Optional[float] = None
    
    # Delivery and SLA
    delivery_timeline: Optional[str] = None
    sla_terms: Optional[str] = None
    penalty_terms: Optional[str] = None
    
    # Digital Signature and Approval
    quotation_pdf_path: Optional[str] = None  # PDF with digital signature
    digitally_signed: bool = False
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None
    
    # Approval Workflow
    approval_status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_comments: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('quotation_id')
    def validate_quotation_id(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Quotation ID is required')
        return v.strip()
    
    @validator('gross_margin', 'net_margin')
    def validate_margins(cls, v):
        if v is not None and v < 0:
            raise ValueError('Margin cannot be negative')
        return v
    
    @validator('otc_price', 'recurring_price', 'total_contract_value')
    def validate_financial_amounts(cls, v):
        if v < 0:
            raise ValueError('Financial amounts cannot be negative')
        return v

# Order Analysis (Linked to Opportunity ID - Form 6 requirement)
class OpportunityOrderAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Purchase Order Analysis
    po_number: str  # Must be unique
    po_amount: float
    po_date: datetime
    po_validity: Optional[datetime] = None
    
    # Terms and Conditions Analysis
    payment_terms: str
    sla_requirements: str
    penalty_clauses: str
    billing_rules: str
    
    # Resource and Deployment Analysis
    manpower_deployment: str  # JSON structure with roles and count
    technical_resources: Optional[str] = None  # JSON structure
    infrastructure_requirements: Optional[str] = None
    
    # Financial Analysis
    revenue_recognition: str  # Monthly, Milestone-based, etc.
    cost_structure: str  # JSON breakdown
    profit_projection: Optional[float] = None
    risk_assessment: Optional[str] = None
    
    # Tax and Compliance
    tax_implications: Optional[str] = None
    gst_treatment: Optional[str] = None
    compliance_requirements: Optional[str] = None
    
    # Project Analysis
    project_duration: Optional[int] = None  # In months
    project_phases: Optional[str] = None  # JSON structure
    delivery_milestones: Optional[str] = None  # JSON structure
    
    # Approval Workflow
    analysis_status: str = "draft"  # draft, review, approved, rejected
    reviewed_by_sales_ops: Optional[str] = None
    reviewed_by_sales_manager: Optional[str] = None
    approved_by_sales_head: Optional[str] = None
    review_comments: Optional[str] = None
    
    # Final Approval
    final_approval_status: str = "pending"  # pending, approved, rejected
    final_approved_by: Optional[str] = None
    final_approved_at: Optional[datetime] = None
    final_approval_comments: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('po_number')
    def validate_po_number(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('PO Number is required')
        return v.strip()
    
    @validator('po_amount')
    def validate_po_amount(cls, v):
        if v <= 0:
            raise ValueError('PO Amount must be positive')
        return v

# SL Process Tracking (Sales Lifecycle tracking)
class SLProcessTracking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    stage_id: str  # Reference to OpportunityStage
    
    # Process Activity Details
    activity_name: str
    activity_description: Optional[str] = None
    activity_type: str  # task, milestone, approval, document, meeting
    
    # Status Tracking
    activity_status: str = "pending"  # pending, in_progress, completed, blocked, cancelled
    progress_percentage: int = 0  # 0-100
    
    # Assignment and Responsibility
    assigned_to: Optional[str] = None  # User ID
    assigned_role: Optional[str] = None  # pretender_lead, tender_lead, sales_manager, etc.
    due_date: Optional[datetime] = None
    
    # Completion Details
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    deliverables: Optional[str] = None  # JSON array of deliverable documents/links
    
    # Dependencies
    depends_on: Optional[str] = None  # JSON array of other activity IDs
    blocks: Optional[str] = None  # JSON array of activities blocked by this one
    
    # Audit Trail
    status_history: Optional[str] = None  # JSON array of status changes
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('progress_percentage')
    def validate_progress(cls, v):
        if v < 0 or v > 100:
            raise ValueError('Progress percentage must be between 0 and 100')
        return v

# ===== OPPORTUNITY MANAGEMENT SYSTEM =====

# Opportunity Stage Master
class OpportunityStage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stage_name: str
    stage_code: str  # L1, L2, L3, etc.
    opportunity_type: str  # "Tender", "Non-Tender", "Shared"
    sequence_order: int
    description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Main Opportunity Model
class Opportunity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str  # Auto-generated OPP-XXXXXXX format
    sr_no: Optional[int] = None  # Auto-generated sequence number
    
    # Mandatory Fields
    opportunity_title: str = Field(..., max_length=255)
    company_id: str  # From Company Master
    current_stage_id: str  # Reference to OpportunityStage
    opportunity_owner_id: str  # Valid user
    state: str = "Open"  # Open/Closed
    opportunity_type: str  # "Tender" / "Non-Tender"
    
    # Optional Fields
    partner_id: Optional[str] = None  # From Partner Master
    expected_closure_date: Optional[datetime] = None
    remarks: Optional[str] = None
    
    # Lead Integration
    lead_id: str  # Linked to Lead ID for traceability
    pot_id: Optional[str] = None  # POT ID reference
    
    # Auto-pulled from Lead
    project_title: Optional[str] = None
    project_description: Optional[str] = None
    project_start_date: Optional[datetime] = None
    project_end_date: Optional[datetime] = None
    expected_revenue: Optional[float] = None
    revenue_currency_id: Optional[str] = None
    lead_source_id: Optional[str] = None
    decision_maker_percentage: Optional[int] = None
    
    # Workflow Fields
    approval_status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_comments: Optional[str] = None
    
    # Qualification Checklist Status
    qualification_status: str = "pending"  # pending, completed, exempted
    qualification_completed_at: Optional[datetime] = None
    qualification_completed_by: Optional[str] = None
    
    # Auto-conversion tracking
    auto_converted: bool = False  # True if auto-converted from lead
    auto_conversion_reason: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('opportunity_title')
    def validate_title(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Opportunity title is required')
        if len(v) > 255:
            raise ValueError('Opportunity title cannot exceed 255 characters')
        return v.strip()
    
    @validator('state')
    def validate_state(cls, v):
        if v not in ["Open", "Closed"]:
            raise ValueError('State must be either Open or Closed')
        return v
    
    @validator('opportunity_type')
    def validate_opportunity_type(cls, v):
        if v not in ["Tender", "Non-Tender"]:
            raise ValueError('Opportunity type must be either Tender or Non-Tender')
        return v

# Opportunity Stage History - Track stage transitions
class OpportunityStageHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    from_stage_id: Optional[str] = None  # Previous stage (null for initial)
    to_stage_id: str  # Current stage
    stage_name: str  # Stage name for easy reference
    transition_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    transitioned_by: str  # User who made the transition
    transition_comments: Optional[str] = None
    pretender_lead_id: Optional[str] = None  # Assigned at L5 for Tender
    tender_lead_id: Optional[str] = None  # Assigned at L5 for Tender
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Qualification Checklist Rules (38 Rules Implementation)
class QualificationRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rule_code: str  # QR001, QR002, etc.
    rule_name: str
    rule_description: str
    category: str  # "Opportunity", "Company", "Discovery", "Competitor", "Stakeholder", etc.
    is_mandatory: bool = True
    opportunity_type: Optional[str] = None  # "Tender", "Non-Tender", "Both"
    sequence_order: int
    validation_logic: Optional[str] = None  # JSON or validation rules
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Opportunity Qualification Status - Track compliance with 38 rules
class OpportunityQualification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    rule_id: str  # Reference to QualificationRule
    compliance_status: str = "pending"  # pending, compliant, non_compliant, exempted
    compliance_notes: Optional[str] = None
    evidence_document_path: Optional[str] = None  # Proof document upload
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    exemption_reason: Optional[str] = None  # For Executive Committee override
    exempted_by: Optional[str] = None
    exempted_at: Optional[datetime] = None
    is_active: bool = True
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Opportunity Details (Form 2)
class OpportunityDetails(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Project Details
    business_type_id: Optional[str] = None
    sub_business_vertical_id: Optional[str] = None
    industry_segment_id: Optional[str] = None
    products: Optional[str] = None  # JSON array or comma-separated
    
    # Tender Specific
    tender_subtype_id: Optional[str] = None  # Mandatory if Tender
    
    # Role Assignments (Users)
    solution_architect_id: Optional[str] = None
    business_analyst_id: Optional[str] = None
    bid_desk_id: Optional[str] = None
    
    # Additional Details
    technical_requirements: Optional[str] = None
    business_requirements: Optional[str] = None
    special_requirements: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Opportunity Contacts (Form 3)
class OpportunityContact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opportunity_id: str
    
    # Mandatory Fields
    designation_id: str  # From designation master
    first_name: str
    last_name: str
    email: EmailStr  # Must be unique within opportunity
    phone: str  # Must be unique within opportunity, 10 digits
    
    # Additional Contact Info
    mobile: Optional[str] = None
    department: Optional[str] = None
    
    # Decision Making
    is_decision_maker: bool = False
    decision_maker_percentage: Optional[int] = None  # 1-100
    influence_level: Optional[str] = None  # "High", "Medium", "Low"
    
    # Contact Status
    is_primary: bool = False
    is_active_contact: bool = True
    contact_status: str = "Active"  # Active, Inactive, Left Company
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('email')
    def validate_email_format(cls, v):
        return v.lower()
    
    @validator('phone')
    def validate_phone(cls, v):
        if not re.match(r'^\d{10}$', v):
            raise ValueError('Phone number must be exactly 10 digits')
        return v
    
    @validator('decision_maker_percentage')
    def validate_decision_percentage(cls, v):
        if v is not None and (v < 1 or v > 100):
            raise ValueError('Decision maker percentage must be between 1 and 100')
        return v

# ===== LEAD MANAGEMENT SYSTEM =====

# Lead Management Pydantic Models
class LeadSubtypeMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_subtype_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TenderSubtypeMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tender_subtype_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubmissionTypeMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    submission_type_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClauseMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    clause_name: str
    clause_description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompetitorMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    competitor_name: str
    competitor_description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DesignationMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    designation_name: str
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BillingMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    billing_type_name: str
    billing_description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Lead Source Master (additional)
class LeadSourceMaster(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_source_name: str
    source_description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Main Lead Model
class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str  # Auto-generated LEAD-XXXXXXX format
    project_title: str
    lead_subtype_id: str
    lead_source_id: str
    company_id: str
    
    # Revenue Information
    expected_revenue: float
    revenue_currency_id: str
    convert_to_opportunity_date: datetime
    
    # Assignment
    assigned_to_user_id: str
    
    # Approval Workflow
    approval_status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_comments: Optional[str] = None
    
    # Project Details
    project_description: Optional[str] = None
    project_start_date: Optional[datetime] = None
    project_end_date: Optional[datetime] = None
    
    # Additional Fields
    decision_maker_percentage: Optional[int] = None  # 1-100
    notes: Optional[str] = None
    
    # Audit Fields
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('expected_revenue')
    def validate_revenue(cls, v):
        if v <= 0:
            raise ValueError('Expected revenue must be positive')
        return v
    
    @validator('decision_maker_percentage')
    def validate_decision_maker_percentage(cls, v):
        if v is not None and (v < 1 or v > 100):
            raise ValueError('Decision maker percentage must be between 1 and 100')
        return v

# Lead Partners (Many-to-Many relationship)
class LeadPartner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    partner_id: str
    role_description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Lead Contacts
class LeadContact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    mobile: Optional[str] = None
    designation_id: Optional[str] = None
    department: Optional[str] = None
    is_primary: bool = False
    is_decision_maker: bool = False
    decision_maker_percentage: Optional[int] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @validator('email')
    def validate_email_format(cls, v):
        return v.lower()
    
    @validator('phone')
    def validate_phone(cls, v):
        if not re.match(r'^\d{10}$', v):
            raise ValueError('Phone number must be exactly 10 digits')
        return v
    
    @validator('decision_maker_percentage')
    def validate_decision_percentage(cls, v):
        if v is not None and (v < 1 or v > 100):
            raise ValueError('Decision maker percentage must be between 1 and 100')
        return v

# Lead Tender Details
class LeadTender(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    tender_subtype_id: str
    submission_type_id: str
    tender_number: Optional[str] = None
    tender_value: Optional[float] = None
    tender_currency_id: Optional[str] = None
    tender_description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Tender Dates
class TenderDate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tender_id: str  # Reference to LeadTender
    date_type: str  # "submission", "opening", "result", etc.
    date_value: datetime
    description: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Tender Clauses
class TenderClause(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tender_id: str  # Reference to LeadTender
    clause_id: str  # Reference to ClauseMaster
    clause_value: Optional[str] = None
    clause_notes: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Lead Competitors
class LeadCompetitor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    competitor_id: str  # Reference to CompetitorMaster
    competitor_strength: Optional[str] = None  # "High", "Medium", "Low"
    competitive_notes: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Lead Documents
class LeadDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    document_type_id: str  # Reference to MasterDocumentTypes
    document_name: str
    file_path: str
    document_description: Optional[str] = None
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    is_deleted: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ===== LEAD CRUD API ENDPOINTS =====

# Helper function to generate Lead ID
async def generate_lead_id():
    """Generate unique LEAD-XXXXXXX format ID"""
    while True:
        # Generate random 6-character alphanumeric string
        import random
        import string
        random_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        lead_id = f"LEAD-{random_id}"
        
        # Check if this ID already exists
        existing = await db.leads.find_one({"lead_id": lead_id, "is_deleted": False})
        if not existing:
            return lead_id

# Lead CRUD Endpoints
@api_router.get("/leads", response_model=APIResponse)
@require_permission("/leads", "view")
async def get_leads(current_user: User = Depends(get_current_user)):
    """Get all leads with enriched data"""
    try:
        # Get leads with enriched master data
        pipeline = [
            {"$match": {"is_deleted": False}},
            # Lookup lead subtype
            {"$lookup": {
                "from": "lead_subtype_master",
                "localField": "lead_subtype_id",
                "foreignField": "id",
                "as": "lead_subtype"
            }},
            {"$unwind": {"path": "$lead_subtype", "preserveNullAndEmptyArrays": True}},
            # Lookup lead source
            {"$lookup": {
                "from": "lead_source_master",
                "localField": "lead_source_id",
                "foreignField": "id",
                "as": "lead_source"
            }},
            {"$unwind": {"path": "$lead_source", "preserveNullAndEmptyArrays": True}},
            # Lookup company
            {"$lookup": {
                "from": "companies",
                "localField": "company_id",
                "foreignField": "company_id",
                "as": "company"
            }},
            {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
            # Lookup currency
            {"$lookup": {
                "from": "master_currencies",
                "localField": "revenue_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            # Lookup assigned user
            {"$lookup": {
                "from": "users",
                "localField": "assigned_to_user_id",
                "foreignField": "id",
                "as": "assigned_user"
            }},
            {"$unwind": {"path": "$assigned_user", "preserveNullAndEmptyArrays": True}},
            # Add enriched fields
            {"$addFields": {
                "lead_subtype_name": "$lead_subtype.lead_subtype_name",
                "lead_source_name": "$lead_source.lead_source_name",
                "company_name": "$company.company_name",
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol",
                "assigned_user_name": "$assigned_user.name"
            }},
            {"$sort": {"created_at": -1}}
        ]
        
        leads_cursor = db.leads.aggregate(pipeline)
        leads = await leads_cursor.to_list(1000)
        
        # Remove MongoDB _id field
        for lead in leads:
            lead.pop("_id", None)
            # Remove nested objects to avoid duplication
            lead.pop("lead_subtype", None)
            lead.pop("lead_source", None)
            lead.pop("company", None)
            lead.pop("currency", None)
            lead.pop("assigned_user", None)
        
        return APIResponse(success=True, message="Leads retrieved successfully", data=leads)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/leads", response_model=APIResponse)
@require_permission("/leads", "create")
async def create_lead(lead_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new lead"""
    try:
        # Generate Lead ID
        lead_id = await generate_lead_id()
        lead_data["lead_id"] = lead_id
        lead_data["created_by"] = current_user.id
        lead_data["updated_by"] = current_user.id
        
        # Validate lead data
        lead = Lead(**lead_data)
        
        # Check for mandatory validations
        # 1. Check if company exists
        company = await db.companies.find_one({"company_id": lead.company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=400, detail="Company not found")
        
        # 2. Check if lead subtype exists
        lead_subtype = await db.lead_subtype_master.find_one({"id": lead.lead_subtype_id, "is_deleted": False})
        if not lead_subtype:
            raise HTTPException(status_code=400, detail="Lead subtype not found")
        
        # 3. Check if lead source exists
        lead_source = await db.lead_source_master.find_one({"id": lead.lead_source_id, "is_deleted": False})
        if not lead_source:
            raise HTTPException(status_code=400, detail="Lead source not found")
        
        # 4. Check if currency exists
        currency = await db.master_currencies.find_one({"currency_id": lead.revenue_currency_id, "is_deleted": False})
        if not currency:
            raise HTTPException(status_code=400, detail="Currency not found")
        
        # 5. Check if assigned user exists
        assigned_user = await db.users.find_one({"id": lead.assigned_to_user_id, "is_deleted": False})
        if not assigned_user:
            raise HTTPException(status_code=400, detail="Assigned user not found")
        
        # Insert lead
        await db.leads.insert_one(lead.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created lead: {lead.project_title} ({lead_id})"))
        
        return APIResponse(success=True, message="Lead created successfully", data={"lead_id": lead_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/leads/{lead_id}", response_model=APIResponse)
@require_permission("/leads", "view")
async def get_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    """Get specific lead with all related data"""
    try:
        # Get lead with enriched data
        pipeline = [
            {"$match": {"id": lead_id, "is_deleted": False}},
            # Add all the lookups from get_leads
            {"$lookup": {
                "from": "lead_subtype_master",
                "localField": "lead_subtype_id",
                "foreignField": "id",
                "as": "lead_subtype"
            }},
            {"$unwind": {"path": "$lead_subtype", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "lead_source_master",
                "localField": "lead_source_id",
                "foreignField": "id",
                "as": "lead_source"
            }},
            {"$unwind": {"path": "$lead_source", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "companies",
                "localField": "company_id",
                "foreignField": "company_id",
                "as": "company"
            }},
            {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "master_currencies",
                "localField": "revenue_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users", 
                "localField": "assigned_to_user_id",
                "foreignField": "id",
                "as": "assigned_user"
            }},
            {"$unwind": {"path": "$assigned_user", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "lead_subtype_name": "$lead_subtype.lead_subtype_name",
                "lead_source_name": "$lead_source.lead_source_name",
                "company_name": "$company.company_name",
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol",
                "assigned_user_name": "$assigned_user.name"
            }}
        ]
        
        leads_cursor = db.leads.aggregate(pipeline)
        leads = await leads_cursor.to_list(1)
        
        if not leads:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        lead = leads[0]
        lead.pop("_id", None)
        lead.pop("lead_subtype", None)
        lead.pop("lead_source", None)
        lead.pop("company", None)
        lead.pop("currency", None)
        lead.pop("assigned_user", None)
        
        return APIResponse(success=True, message="Lead retrieved successfully", data=lead)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/leads/{lead_id}", response_model=APIResponse)
@require_permission("/leads", "edit")
async def update_lead(lead_id: str, lead_data: dict, current_user: User = Depends(get_current_user)):
    """Update a lead"""
    try:
        # Check if lead exists
        existing_lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not existing_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Check if lead is approved (approved leads are read-only)
        if existing_lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot update approved lead")
        
        # Update audit fields
        lead_data["updated_by"] = current_user.id
        lead_data["updated_at"] = datetime.now(timezone.utc)
        
        # Validate foreign keys if provided
        if "company_id" in lead_data:
            company = await db.companies.find_one({"company_id": lead_data["company_id"], "is_deleted": False})
            if not company:
                raise HTTPException(status_code=400, detail="Company not found")
        
        if "lead_subtype_id" in lead_data:
            lead_subtype = await db.lead_subtype_master.find_one({"id": lead_data["lead_subtype_id"], "is_deleted": False})
            if not lead_subtype:
                raise HTTPException(status_code=400, detail="Lead subtype not found")
        
        if "lead_source_id" in lead_data:
            lead_source = await db.lead_source_master.find_one({"id": lead_data["lead_source_id"], "is_deleted": False})
            if not lead_source:
                raise HTTPException(status_code=400, detail="Lead source not found")
        
        if "revenue_currency_id" in lead_data:
            currency = await db.master_currencies.find_one({"currency_id": lead_data["revenue_currency_id"], "is_deleted": False})
            if not currency:
                raise HTTPException(status_code=400, detail="Currency not found")
        
        if "assigned_to_user_id" in lead_data:
            assigned_user = await db.users.find_one({"id": lead_data["assigned_to_user_id"], "is_deleted": False})
            if not assigned_user:
                raise HTTPException(status_code=400, detail="Assigned user not found")
        
        # Update lead
        await db.leads.update_one({"id": lead_id}, {"$set": lead_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Updated lead: {existing_lead.get('project_title', lead_id)}"))
        
        return APIResponse(success=True, message="Lead updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/leads/{lead_id}", response_model=APIResponse)
@require_permission("/leads", "delete")
async def delete_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a lead"""
    try:
        # Check if lead exists
        existing_lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not existing_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Soft delete lead
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {
                "is_deleted": True,
                "updated_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Deleted lead: {existing_lead.get('project_title', lead_id)}"))
        
        return APIResponse(success=True, message="Lead deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lead Approval Endpoint
@api_router.put("/leads/{lead_id}/approve", response_model=APIResponse)
@require_permission("/leads", "edit")
async def approve_lead(lead_id: str, approval_data: dict, current_user: User = Depends(get_current_user)):
    """Approve or reject a lead"""
    try:
        # Check if lead exists
        existing_lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not existing_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Validate approval status
        approval_status = approval_data.get("approval_status")
        if approval_status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Approval status must be 'approved' or 'rejected'")
        
        # Update approval fields
        update_data = {
            "approval_status": approval_status,
            "approved_by": current_user.id,
            "approved_at": datetime.now(timezone.utc),
            "approval_comments": approval_data.get("approval_comments", ""),
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.leads.update_one({"id": lead_id}, {"$set": update_data})
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"{approval_status.title()} lead: {existing_lead.get('project_title', lead_id)}"))
        
        return APIResponse(success=True, message=f"Lead {approval_status} successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== LEAD NESTED ENTITY APIs =====

# Lead Contacts CRUD
@api_router.get("/leads/{lead_id}/contacts", response_model=APIResponse)
@require_permission("/leads", "view")
async def get_lead_contacts(lead_id: str, current_user: User = Depends(get_current_user)):
    """Get all contacts for a specific lead"""
    try:
        # Verify lead exists
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get contacts with enriched data
        pipeline = [
            {"$match": {"lead_id": lead_id, "is_deleted": False}},
            {"$lookup": {
                "from": "designation_master",
                "localField": "designation_id", 
                "foreignField": "id",
                "as": "designation"
            }},
            {"$unwind": {"path": "$designation", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "designation_name": "$designation.designation_name"
            }},
            {"$sort": {"is_primary": -1, "created_at": 1}}
        ]
        
        contacts_cursor = db.lead_contacts.aggregate(pipeline)
        contacts = await contacts_cursor.to_list(100)
        
        for contact in contacts:
            contact.pop("_id", None)
            contact.pop("designation", None)
        
        return APIResponse(success=True, message="Lead contacts retrieved successfully", data=contacts)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/leads/{lead_id}/contacts", response_model=APIResponse)
@require_permission("/leads", "edit")
async def create_lead_contact(lead_id: str, contact_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new contact for a lead"""
    try:
        # Verify lead exists
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Check if lead is approved
        if lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot modify approved lead")
        
        contact_data["lead_id"] = lead_id
        contact_data["created_by"] = current_user.id
        contact_data["updated_by"] = current_user.id
        
        # Validate contact data
        contact = LeadContact(**contact_data)
        
        # Check for unique email within this lead
        existing_email = await db.lead_contacts.find_one({
            "lead_id": lead_id,
            "email": contact.email,
            "is_deleted": False
        })
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists for this lead")
        
        # Check for unique phone within this lead
        existing_phone = await db.lead_contacts.find_one({
            "lead_id": lead_id,
            "phone": contact.phone,
            "is_deleted": False
        })
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone number already exists for this lead")
        
        # If this is set as primary, unset other primary contacts for this lead
        if contact.is_primary:
            await db.lead_contacts.update_many(
                {"lead_id": lead_id, "is_deleted": False},
                {"$set": {"is_primary": False, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
            )
        
        # Insert contact
        await db.lead_contacts.insert_one(contact.dict())
        
        return APIResponse(success=True, message="Lead contact created successfully", data={"contact_id": contact.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/leads/{lead_id}/contacts/{contact_id}", response_model=APIResponse)
@require_permission("/leads", "edit")
async def update_lead_contact(lead_id: str, contact_id: str, contact_data: dict, current_user: User = Depends(get_current_user)):
    """Update a lead contact"""
    try:
        # Verify lead exists and is not approved
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        if lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot modify approved lead")
        
        # Check if contact exists
        existing_contact = await db.lead_contacts.find_one({"id": contact_id, "lead_id": lead_id, "is_deleted": False})
        if not existing_contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact_data["updated_by"] = current_user.id
        contact_data["updated_at"] = datetime.now(timezone.utc)
        
        # If this is set as primary, unset other primary contacts for this lead
        if contact_data.get("is_primary"):
            await db.lead_contacts.update_many(
                {"lead_id": lead_id, "is_deleted": False, "id": {"$ne": contact_id}},
                {"$set": {"is_primary": False, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}}
            )
        
        # Update contact
        await db.lead_contacts.update_one({"id": contact_id}, {"$set": contact_data})
        
        return APIResponse(success=True, message="Lead contact updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/leads/{lead_id}/contacts/{contact_id}", response_model=APIResponse)
@require_permission("/leads", "edit")
async def delete_lead_contact(lead_id: str, contact_id: str, current_user: User = Depends(get_current_user)):
    """Delete a lead contact"""
    try:
        # Verify lead exists and is not approved
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        if lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot modify approved lead")
        
        # Check if contact exists
        existing_contact = await db.lead_contacts.find_one({"id": contact_id, "lead_id": lead_id, "is_deleted": False})
        if not existing_contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Soft delete contact
        await db.lead_contacts.update_one(
            {"id": contact_id},
            {"$set": {
                "is_deleted": True,
                "updated_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return APIResponse(success=True, message="Lead contact deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lead Tender Details CRUD
@api_router.get("/leads/{lead_id}/tender", response_model=APIResponse)
@require_permission("/leads", "view")
async def get_lead_tender(lead_id: str, current_user: User = Depends(get_current_user)):
    """Get tender details for a specific lead"""
    try:
        # Verify lead exists
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get tender with enriched data
        pipeline = [
            {"$match": {"lead_id": lead_id, "is_deleted": False}},
            {"$lookup": {
                "from": "tender_subtype_master",
                "localField": "tender_subtype_id", 
                "foreignField": "id",
                "as": "tender_subtype"
            }},
            {"$unwind": {"path": "$tender_subtype", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "submission_type_master",
                "localField": "submission_type_id",
                "foreignField": "id", 
                "as": "submission_type"
            }},
            {"$unwind": {"path": "$submission_type", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "master_currencies",
                "localField": "tender_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "tender_subtype_name": "$tender_subtype.tender_subtype_name",
                "submission_type_name": "$submission_type.submission_type_name",
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol"
            }}
        ]
        
        tender_cursor = db.lead_tenders.aggregate(pipeline)
        tenders = await tender_cursor.to_list(1)
        
        tender = tenders[0] if tenders else None
        if tender:
            tender.pop("_id", None)
            tender.pop("tender_subtype", None)
            tender.pop("submission_type", None)
            tender.pop("currency", None)
        
        return APIResponse(success=True, message="Lead tender retrieved successfully", data=tender)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/leads/{lead_id}/tender", response_model=APIResponse)
@require_permission("/leads", "edit")
async def create_lead_tender(lead_id: str, tender_data: dict, current_user: User = Depends(get_current_user)):
    """Create tender details for a lead"""
    try:
        # Verify lead exists and is not approved
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        if lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot modify approved lead")
        
        # Check if tender already exists for this lead
        existing_tender = await db.lead_tenders.find_one({"lead_id": lead_id, "is_deleted": False})
        if existing_tender:
            raise HTTPException(status_code=400, detail="Tender details already exist for this lead")
        
        tender_data["lead_id"] = lead_id
        tender_data["created_by"] = current_user.id
        tender_data["updated_by"] = current_user.id
        
        # Validate tender data
        tender = LeadTender(**tender_data)
        
        # Insert tender
        await db.lead_tenders.insert_one(tender.dict())
        
        return APIResponse(success=True, message="Lead tender created successfully", data={"tender_id": tender.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lead Competitors CRUD
@api_router.get("/leads/{lead_id}/competitors", response_model=APIResponse)
@require_permission("/leads", "view")
async def get_lead_competitors(lead_id: str, current_user: User = Depends(get_current_user)):
    """Get all competitors for a specific lead"""
    try:
        # Verify lead exists
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get competitors with enriched data
        pipeline = [
            {"$match": {"lead_id": lead_id, "is_deleted": False}},
            {"$lookup": {
                "from": "competitor_master",
                "localField": "competitor_id",
                "foreignField": "id",
                "as": "competitor"
            }},
            {"$unwind": {"path": "$competitor", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "competitor_name": "$competitor.competitor_name",
                "competitor_description": "$competitor.competitor_description"
            }},
            {"$sort": {"created_at": 1}}
        ]
        
        competitors_cursor = db.lead_competitors.aggregate(pipeline)
        competitors = await competitors_cursor.to_list(100)
        
        for competitor in competitors:
            competitor.pop("_id", None)
            competitor.pop("competitor", None)
        
        return APIResponse(success=True, message="Lead competitors retrieved successfully", data=competitors)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/leads/{lead_id}/competitors", response_model=APIResponse)
@require_permission("/leads", "edit")
async def create_lead_competitor(lead_id: str, competitor_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new competitor for a lead"""
    try:
        # Verify lead exists and is not approved
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        if lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot modify approved lead")
        
        competitor_data["lead_id"] = lead_id
        competitor_data["created_by"] = current_user.id
        competitor_data["updated_by"] = current_user.id
        
        # Validate competitor data
        competitor = LeadCompetitor(**competitor_data)
        
        # Check if competitor already exists for this lead
        existing_competitor = await db.lead_competitors.find_one({
            "lead_id": lead_id,
            "competitor_id": competitor.competitor_id,
            "is_deleted": False
        })
        if existing_competitor:
            raise HTTPException(status_code=400, detail="Competitor already exists for this lead")
        
        # Insert competitor
        await db.lead_competitors.insert_one(competitor.dict())
        
        return APIResponse(success=True, message="Lead competitor created successfully", data={"competitor_id": competitor.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lead Documents CRUD
@api_router.get("/leads/{lead_id}/documents", response_model=APIResponse)
@require_permission("/leads", "view")
async def get_lead_documents(lead_id: str, current_user: User = Depends(get_current_user)):
    """Get all documents for a specific lead"""
    try:
        # Verify lead exists
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get documents with enriched data
        pipeline = [
            {"$match": {"lead_id": lead_id, "is_deleted": False}},
            {"$lookup": {
                "from": "master_document_types",
                "localField": "document_type_id",
                "foreignField": "document_type_id",
                "as": "document_type"
            }},
            {"$unwind": {"path": "$document_type", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "document_type_name": "$document_type.document_type_name"
            }},
            {"$sort": {"upload_date": -1}}
        ]
        
        documents_cursor = db.lead_documents.aggregate(pipeline)
        documents = await documents_cursor.to_list(100)
        
        for document in documents:
            document.pop("_id", None)
            document.pop("document_type", None)
        
        return APIResponse(success=True, message="Lead documents retrieved successfully", data=documents)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/leads/{lead_id}/documents", response_model=APIResponse)
@require_permission("/leads", "edit")
async def create_lead_document(lead_id: str, document_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new document for a lead"""
    try:
        # Verify lead exists and is not approved
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        if lead.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Cannot modify approved lead")
        
        document_data["lead_id"] = lead_id
        document_data["created_by"] = current_user.id
        document_data["updated_by"] = current_user.id
        
        # Validate document data
        document = LeadDocument(**document_data)
        
        # Insert document
        await db.lead_documents.insert_one(document.dict())
        
        return APIResponse(success=True, message="Lead document created successfully", data={"document_id": document.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== LEAD BULK OPERATIONS =====

@api_router.get("/leads/export", response_model=APIResponse)
@require_permission("/leads", "view")
async def export_leads(current_user: User = Depends(get_current_user)):
    """Export leads to CSV format"""
    try:
        # Get leads with enriched data for export
        pipeline = [
            {"$match": {"is_deleted": False}},
            # Add all the lookups from get_leads
            {"$lookup": {
                "from": "lead_subtype_master",
                "localField": "lead_subtype_id",
                "foreignField": "id",
                "as": "lead_subtype"
            }},
            {"$unwind": {"path": "$lead_subtype", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "lead_source_master",
                "localField": "lead_source_id",
                "foreignField": "id",
                "as": "lead_source"
            }},
            {"$unwind": {"path": "$lead_source", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "companies",
                "localField": "company_id",
                "foreignField": "company_id",
                "as": "company"
            }},
            {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "master_currencies",
                "localField": "revenue_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "assigned_to_user_id",
                "foreignField": "id",
                "as": "assigned_user"
            }},
            {"$unwind": {"path": "$assigned_user", "preserveNullAndEmptyArrays": True}},
            # Project fields for export
            {"$project": {
                "lead_id": 1,
                "project_title": 1,
                "lead_subtype_name": "$lead_subtype.lead_subtype_name",
                "lead_source_name": "$lead_source.lead_source_name",
                "company_name": "$company.company_name",
                "expected_revenue": 1,
                "currency_code": "$currency.currency_code",
                "convert_to_opportunity_date": 1,
                "assigned_user_name": "$assigned_user.name",
                "approval_status": 1,
                "project_description": 1,
                "decision_maker_percentage": 1,
                "notes": 1,
                "created_at": 1,
                "updated_at": 1
            }},
            {"$sort": {"created_at": -1}}
        ]
        
        leads_cursor = db.leads.aggregate(pipeline)
        leads = await leads_cursor.to_list(1000)  # Limit to 1000 records for export
        
        # Format dates for CSV
        for lead in leads:
            if lead.get("created_at"):
                lead["created_at"] = lead["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if lead.get("updated_at"):
                lead["updated_at"] = lead["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
            if lead.get("convert_to_opportunity_date"):
                lead["convert_to_opportunity_date"] = lead["convert_to_opportunity_date"].strftime("%Y-%m-%d")
        
        return APIResponse(success=True, message="Leads exported successfully", data=leads)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/leads/import", response_model=APIResponse)
@require_permission("/leads", "create")
async def import_leads(leads_data: list, current_user: User = Depends(get_current_user)):
    """Import leads from CSV data"""
    try:
        imported_count = 0
        errors = []
        
        for index, lead_data in enumerate(leads_data):
            try:
                # Generate Lead ID
                lead_id = await generate_lead_id()
                lead_data["lead_id"] = lead_id
                lead_data["created_by"] = current_user.id
                lead_data["updated_by"] = current_user.id
                
                # Validate required fields
                required_fields = ["project_title", "lead_subtype_id", "lead_source_id", "company_id", 
                                 "expected_revenue", "revenue_currency_id", "convert_to_opportunity_date", "assigned_to_user_id"]
                
                for field in required_fields:
                    if not lead_data.get(field):
                        raise ValueError(f"Missing required field: {field}")
                
                # Convert string dates to datetime if needed
                if isinstance(lead_data.get("convert_to_opportunity_date"), str):
                    lead_data["convert_to_opportunity_date"] = datetime.fromisoformat(lead_data["convert_to_opportunity_date"])
                
                # Validate lead data
                lead = Lead(**lead_data)
                
                # Check if lead with same project title already exists
                existing_lead = await db.leads.find_one({
                    "project_title": lead.project_title,
                    "company_id": lead.company_id,
                    "is_deleted": False
                })
                if existing_lead:
                    raise ValueError(f"Lead with project title '{lead.project_title}' already exists for this company")
                
                # Insert lead
                await db.leads.insert_one(lead.dict())
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 1}: {str(e)}")
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Imported {imported_count} leads"))
        
        result = {
            "imported_count": imported_count,
            "total_count": len(leads_data),
            "errors": errors
        }
        
        return APIResponse(success=True, message=f"Import completed. {imported_count}/{len(leads_data)} leads imported successfully.", data=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lead Search and Filtering
@api_router.get("/leads/search", response_model=APIResponse)
@require_permission("/leads", "view")
async def search_leads(
    q: str = None,  # Search query
    status: str = None,  # approval_status filter
    subtype_id: str = None,  # lead_subtype_id filter
    source_id: str = None,  # lead_source_id filter
    company_id: str = None,  # company_id filter
    assigned_to: str = None,  # assigned_to_user_id filter
    date_from: str = None,  # created_at >= date_from
    date_to: str = None,  # created_at <= date_to
    min_revenue: float = None,  # expected_revenue >= min_revenue
    max_revenue: float = None,  # expected_revenue <= max_revenue
    limit: int = 50,  # Maximum results to return
    offset: int = 0,  # Pagination offset
    current_user: User = Depends(get_current_user)
):
    """Advanced search and filtering for leads"""
    try:
        # Build match criteria
        match_criteria = {"is_deleted": False}
        
        # Text search on project title, notes, and project description
        if q:
            match_criteria["$or"] = [
                {"project_title": {"$regex": q, "$options": "i"}},
                {"notes": {"$regex": q, "$options": "i"}},
                {"project_description": {"$regex": q, "$options": "i"}}
            ]
        
        # Status filter
        if status:
            match_criteria["approval_status"] = status
        
        # Subtype filter
        if subtype_id:
            match_criteria["lead_subtype_id"] = subtype_id
        
        # Source filter
        if source_id:
            match_criteria["lead_source_id"] = source_id
        
        # Company filter
        if company_id:
            match_criteria["company_id"] = company_id
        
        # Assigned user filter
        if assigned_to:
            match_criteria["assigned_to_user_id"] = assigned_to
        
        # Date range filter
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = datetime.fromisoformat(date_from)
            if date_to:
                date_filter["$lte"] = datetime.fromisoformat(date_to)
            match_criteria["created_at"] = date_filter
        
        # Revenue range filter
        if min_revenue is not None or max_revenue is not None:
            revenue_filter = {}
            if min_revenue is not None:
                revenue_filter["$gte"] = min_revenue
            if max_revenue is not None:
                revenue_filter["$lte"] = max_revenue
            match_criteria["expected_revenue"] = revenue_filter
        
        # Build aggregation pipeline
        pipeline = [
            {"$match": match_criteria},
            # Add enrichment lookups (same as get_leads)
            {"$lookup": {
                "from": "lead_subtype_master",
                "localField": "lead_subtype_id",
                "foreignField": "id",
                "as": "lead_subtype"
            }},
            {"$unwind": {"path": "$lead_subtype", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "lead_source_master", 
                "localField": "lead_source_id",
                "foreignField": "id",
                "as": "lead_source"
            }},
            {"$unwind": {"path": "$lead_source", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "companies",
                "localField": "company_id",
                "foreignField": "company_id",
                "as": "company"
            }},
            {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "master_currencies",
                "localField": "revenue_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "assigned_to_user_id",
                "foreignField": "id",
                "as": "assigned_user"
            }},
            {"$unwind": {"path": "$assigned_user", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "lead_subtype_name": "$lead_subtype.lead_subtype_name",
                "lead_source_name": "$lead_source.lead_source_name",
                "company_name": "$company.company_name",
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol",
                "assigned_user_name": "$assigned_user.name"
            }},
            {"$sort": {"created_at": -1}},
            {"$skip": offset},
            {"$limit": limit}
        ]
        
        # Get total count for pagination
        count_pipeline = [
            {"$match": match_criteria},
            {"$count": "total"}
        ]
        
        # Execute queries
        leads_cursor = db.leads.aggregate(pipeline)
        leads = await leads_cursor.to_list(limit)
        
        count_cursor = db.leads.aggregate(count_pipeline)
        count_result = await count_cursor.to_list(1)
        total_count = count_result[0]["total"] if count_result else 0
        
        # Clean up results
        for lead in leads:
            lead.pop("_id", None)
            lead.pop("lead_subtype", None)
            lead.pop("lead_source", None)
            lead.pop("company", None)
            lead.pop("currency", None)
            lead.pop("assigned_user", None)
        
        result = {
            "leads": leads,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total_count
        }
        
        return APIResponse(success=True, message="Lead search completed successfully", data=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== OPPORTUNITY CRUD API ENDPOINTS =====

# Helper function to generate Opportunity ID
async def generate_opportunity_id():
    """Generate unique OPP-XXXXXXX format ID (7-digit padded)"""
    while True:
        # Generate random 7-character alphanumeric string
        import random
        import string
        random_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=7))
        opportunity_id = f"OPP-{random_id}"
        
        # Check if this ID already exists
        existing = await db.opportunities.find_one({"opportunity_id": opportunity_id, "is_deleted": False})
        if not existing:
            return opportunity_id

# Helper function to get next serial number
async def get_next_sr_no():
    """Get next sequential serial number for opportunities"""
    try:
        # Get the highest sr_no
        pipeline = [
            {"$match": {"is_deleted": False, "sr_no": {"$exists": True, "$ne": None}}},
            {"$sort": {"sr_no": -1}},
            {"$limit": 1}
        ]
        result = await db.opportunities.aggregate(pipeline).to_list(1)
        return (result[0]["sr_no"] + 1) if result else 1
    except:
        return 1

# Auto-conversion function for leads older than 4 weeks
async def check_and_convert_old_leads():
    """Auto-convert approved leads older than 4 weeks to opportunities"""
    try:
        four_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=4)
        
        # Find approved leads older than 4 weeks without linked opportunities
        old_leads_cursor = db.leads.find({
            "approval_status": "approved",
            "approved_at": {"$lte": four_weeks_ago},
            "is_deleted": False,
            "is_active": True
        })
        
        old_leads = await old_leads_cursor.to_list(100)  # Limit to 100 at a time
        converted_count = 0
        
        for lead in old_leads:
            # Check if opportunity already exists for this lead
            existing_opp = await db.opportunities.find_one({
                "lead_id": lead["id"],
                "is_deleted": False
            })
            
            if not existing_opp:
                # Auto-convert to opportunity
                opp_id = await generate_opportunity_id()
                sr_no = await get_next_sr_no()
                
                # Determine opportunity type based on lead subtype
                lead_subtype = await db.lead_subtype_master.find_one({
                    "id": lead.get("lead_subtype_id"),
                    "is_deleted": False
                })
                
                opportunity_type = "Non-Tender"
                if lead_subtype and lead_subtype.get("lead_subtype_name") in ["Tender", "Pretender"]:
                    opportunity_type = "Tender"
                
                # Get initial stage for this opportunity type
                initial_stage = await db.opportunity_stages.find_one({
                    "opportunity_type": opportunity_type,
                    "sequence_order": 1,
                    "is_deleted": False
                })
                
                if not initial_stage:
                    # Create default stages if they don't exist
                    await initialize_opportunity_stages()
                    initial_stage = await db.opportunity_stages.find_one({
                        "opportunity_type": opportunity_type,
                        "sequence_order": 1,
                        "is_deleted": False
                    })
                
                opportunity_data = Opportunity(
                    opportunity_id=opp_id,
                    sr_no=sr_no,
                    opportunity_title=lead.get("project_title", "Auto-converted Opportunity"),
                    company_id=lead.get("company_id"),
                    current_stage_id=initial_stage["id"] if initial_stage else None,
                    opportunity_owner_id=lead.get("assigned_to_user_id"),
                    opportunity_type=opportunity_type,
                    lead_id=lead["id"],
                    project_title=lead.get("project_title"),
                    project_description=lead.get("project_description"),
                    project_start_date=lead.get("project_start_date"),
                    project_end_date=lead.get("project_end_date"),
                    expected_revenue=lead.get("expected_revenue"),
                    revenue_currency_id=lead.get("revenue_currency_id"),
                    lead_source_id=lead.get("lead_source_id"),
                    decision_maker_percentage=lead.get("decision_maker_percentage"),
                    auto_converted=True,
                    auto_conversion_reason="Auto-converted after 4 weeks in approved status",
                    created_by="system",
                    updated_by="system"
                )
                
                # Insert opportunity
                await db.opportunities.insert_one(opportunity_data.dict())
                
                # Create stage history entry
                if initial_stage:
                    stage_history = OpportunityStageHistory(
                        opportunity_id=opportunity_data.id,
                        to_stage_id=initial_stage["id"],
                        stage_name=initial_stage["stage_name"],
                        transitioned_by="system"
                    )
                    await db.opportunity_stage_history.insert_one(stage_history.dict())
                
                # Mark lead as converted (optional - keep it active for reference)
                await db.leads.update_one(
                    {"id": lead["id"]},
                    {"$set": {
                        "notes": f"{lead.get('notes', '')} [Auto-converted to Opportunity {opp_id}]".strip(),
                        "updated_by": "system",
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                
                converted_count += 1
        
        if converted_count > 0:
            print(f"Auto-converted {converted_count} old approved leads to opportunities")
        
        return converted_count
        
    except Exception as e:
        print(f"Error in auto-conversion: {str(e)}")
        return 0

# Initialize Lead Management master data
async def initialize_lead_management_data():
    """Initialize Lead Management master data"""
    try:
        # Lead Subtypes
        lead_subtypes = ["Non Tender", "Tender", "Pretender"]
        for subtype_name in lead_subtypes:
            existing = await db.lead_subtype_master.find_one({"lead_subtype_name": subtype_name, "is_deleted": False})
            if not existing:
                subtype = LeadSubtypeMaster(lead_subtype_name=subtype_name)
                await db.lead_subtype_master.insert_one(subtype.dict())
        
        # Tender Subtypes
        tender_subtypes = ["Open Tender", "Limited Tender", "Single Tender", "Global Tender", "E-Tender", "Reverse Auction"]
        for tender_subtype_name in tender_subtypes:
            existing = await db.tender_subtype_master.find_one({"tender_subtype_name": tender_subtype_name, "is_deleted": False})
            if not existing:
                tender_subtype = TenderSubtypeMaster(tender_subtype_name=tender_subtype_name)
                await db.tender_subtype_master.insert_one(tender_subtype.dict())
        
        # Submission Types
        submission_types = ["Online", "Offline", "Email", "Hard Copy", "Portal Upload"]
        for submission_type_name in submission_types:
            existing = await db.submission_type_master.find_one({"submission_type_name": submission_type_name, "is_deleted": False})
            if not existing:
                submission_type = SubmissionTypeMaster(submission_type_name=submission_type_name)
                await db.submission_type_master.insert_one(submission_type.dict())
        
        # Clauses
        clauses = [
            {"clause_name": "Payment Terms", "clause_description": "Terms related to payment schedule and methods"},
            {"clause_name": "Delivery Terms", "clause_description": "Terms related to delivery timeline and conditions"},
            {"clause_name": "Warranty Terms", "clause_description": "Warranty and support related terms"},
            {"clause_name": "Penalty Clause", "clause_description": "Penalty terms for delays or non-compliance"},
            {"clause_name": "Force Majeure", "clause_description": "Terms for unforeseen circumstances"},
            {"clause_name": "Termination Clause", "clause_description": "Contract termination conditions"}
        ]
        for clause_data in clauses:
            existing = await db.clause_master.find_one({"clause_name": clause_data["clause_name"], "is_deleted": False})
            if not existing:
                clause = ClauseMaster(**clause_data)
                await db.clause_master.insert_one(clause.dict())
        
        # Competitors
        competitors = [
            {"competitor_name": "TCS", "competitor_description": "Tata Consultancy Services"},
            {"competitor_name": "Infosys", "competitor_description": "Infosys Limited"},
            {"competitor_name": "Wipro", "competitor_description": "Wipro Limited"},
            {"competitor_name": "Accenture", "competitor_description": "Accenture Technologies"},
            {"competitor_name": "IBM", "competitor_description": "International Business Machines"},
            {"competitor_name": "Local Player", "competitor_description": "Local/Regional competitor"}
        ]
        for competitor_data in competitors:
            existing = await db.competitor_master.find_one({"competitor_name": competitor_data["competitor_name"], "is_deleted": False})
            if not existing:
                competitor = CompetitorMaster(**competitor_data)
                await db.competitor_master.insert_one(competitor.dict())
        
        # Designations
        designations = [
            "Manager", "Senior Manager", "Director", "VP", "President", "CEO", "CTO", "CFO",
            "Team Lead", "Senior Developer", "Developer", "Analyst", "Consultant", 
            "Project Manager", "Product Manager", "Sales Manager", "Marketing Manager"
        ]
        for designation_name in designations:
            existing = await db.designation_master.find_one({"designation_name": designation_name, "is_deleted": False})
            if not existing:
                designation = DesignationMaster(designation_name=designation_name)
                await db.designation_master.insert_one(designation.dict())
        
        # Billing Types
        billing_types = [
            {"billing_type_name": "Fixed Price", "billing_description": "Fixed price for entire project"},
            {"billing_type_name": "Time & Material", "billing_description": "Billing based on time and materials used"},
            {"billing_type_name": "Milestone Based", "billing_description": "Payment based on project milestones"},
            {"billing_type_name": "Retainer", "billing_description": "Monthly retainer model"},
            {"billing_type_name": "Per Unit", "billing_description": "Per unit or per transaction pricing"}
        ]
        for billing_data in billing_types:
            existing = await db.billing_master.find_one({"billing_type_name": billing_data["billing_type_name"], "is_deleted": False})
            if not existing:
                billing = BillingMaster(**billing_data)
                await db.billing_master.insert_one(billing.dict())
        
        # Lead Sources
        lead_sources = [
            {"lead_source_name": "Website", "source_description": "Leads from company website"},
            {"lead_source_name": "Referral", "source_description": "Leads from referrals"},
            {"lead_source_name": "Cold Calling", "source_description": "Leads from cold calling campaigns"},
            {"lead_source_name": "Email Campaign", "source_description": "Leads from email marketing"},
            {"lead_source_name": "Social Media", "source_description": "Leads from social media platforms"},
            {"lead_source_name": "Trade Show", "source_description": "Leads from trade shows and events"},
            {"lead_source_name": "Partner", "source_description": "Leads from business partners"},
            {"lead_source_name": "Advertisement", "source_description": "Leads from advertisements"}
        ]
        for source_data in lead_sources:
            existing = await db.lead_source_master.find_one({"lead_source_name": source_data["lead_source_name"], "is_deleted": False})
            if not existing:
                source = LeadSourceMaster(**source_data)
                await db.lead_source_master.insert_one(source.dict())
        
        print("Lead Management master data initialized successfully")
        
    except Exception as e:
        print(f"Error initializing Lead Management data: {str(e)}")

# Initialize Lead Management master data
async def initialize_lead_management_data():
    """Initialize Lead Management master data"""
    try:
        # Lead Subtypes
        lead_subtypes = ["Non Tender", "Tender", "Pretender"]
        for subtype_name in lead_subtypes:
            existing = await db.lead_subtype_master.find_one({"lead_subtype_name": subtype_name, "is_deleted": False})
            if not existing:
                subtype = LeadSubtypeMaster(lead_subtype_name=subtype_name)
                await db.lead_subtype_master.insert_one(subtype.dict())
        
        # Tender Subtypes
        tender_subtypes = ["Open Tender", "Limited Tender", "Single Tender", "Global Tender", "E-Tender", "Reverse Auction"]
        for tender_subtype_name in tender_subtypes:
            existing = await db.tender_subtype_master.find_one({"tender_subtype_name": tender_subtype_name, "is_deleted": False})
            if not existing:
                tender_subtype = TenderSubtypeMaster(tender_subtype_name=tender_subtype_name)
                await db.tender_subtype_master.insert_one(tender_subtype.dict())
        
        # Submission Types
        submission_types = ["Online", "Offline", "Email", "Hard Copy", "Portal Upload"]
        for submission_type_name in submission_types:
            existing = await db.submission_type_master.find_one({"submission_type_name": submission_type_name, "is_deleted": False})
            if not existing:
                submission_type = SubmissionTypeMaster(submission_type_name=submission_type_name)
                await db.submission_type_master.insert_one(submission_type.dict())
        
        # Clauses
        clauses = [
            {"clause_name": "Payment Terms", "clause_description": "Terms related to payment schedule and methods"},
            {"clause_name": "Delivery Terms", "clause_description": "Terms related to delivery timeline and conditions"},
            {"clause_name": "Warranty Terms", "clause_description": "Warranty and support related terms"},
            {"clause_name": "Penalty Clause", "clause_description": "Penalty terms for delays or non-compliance"},
            {"clause_name": "Force Majeure", "clause_description": "Terms for unforeseen circumstances"},
            {"clause_name": "Termination Clause", "clause_description": "Contract termination conditions"}
        ]
        for clause_data in clauses:
            existing = await db.clause_master.find_one({"clause_name": clause_data["clause_name"], "is_deleted": False})
            if not existing:
                clause = ClauseMaster(**clause_data)
                await db.clause_master.insert_one(clause.dict())
        
        # Competitors
        competitors = [
            {"competitor_name": "TCS", "competitor_description": "Tata Consultancy Services"},
            {"competitor_name": "Infosys", "competitor_description": "Infosys Limited"},
            {"competitor_name": "Wipro", "competitor_description": "Wipro Limited"},
            {"competitor_name": "Accenture", "competitor_description": "Accenture Technologies"},
            {"competitor_name": "IBM", "competitor_description": "International Business Machines"},
            {"competitor_name": "Local Player", "competitor_description": "Local/Regional competitor"}
        ]
        for competitor_data in competitors:
            existing = await db.competitor_master.find_one({"competitor_name": competitor_data["competitor_name"], "is_deleted": False})
            if not existing:
                competitor = CompetitorMaster(**competitor_data)
                await db.competitor_master.insert_one(competitor.dict())
        
        # Designations
        designations = [
            "Manager", "Senior Manager", "Director", "VP", "President", "CEO", "CTO", "CFO",
            "Team Lead", "Senior Developer", "Developer", "Analyst", "Consultant", 
            "Project Manager", "Product Manager", "Sales Manager", "Marketing Manager"
        ]
        for designation_name in designations:
            existing = await db.designation_master.find_one({"designation_name": designation_name, "is_deleted": False})
            if not existing:
                designation = DesignationMaster(designation_name=designation_name)
                await db.designation_master.insert_one(designation.dict())
        
        # Billing Types
        billing_types = [
            {"billing_type_name": "Fixed Price", "billing_description": "Fixed price for entire project"},
            {"billing_type_name": "Time & Material", "billing_description": "Billing based on time and materials used"},
            {"billing_type_name": "Milestone Based", "billing_description": "Payment based on project milestones"},
            {"billing_type_name": "Retainer", "billing_description": "Monthly retainer model"},
            {"billing_type_name": "Per Unit", "billing_description": "Per unit or per transaction pricing"}
        ]
        for billing_data in billing_types:
            existing = await db.billing_master.find_one({"billing_type_name": billing_data["billing_type_name"], "is_deleted": False})
            if not existing:
                billing = BillingMaster(**billing_data)
                await db.billing_master.insert_one(billing.dict())
        
        # Lead Sources
        lead_sources = [
            {"lead_source_name": "Website", "source_description": "Leads from company website"},
            {"lead_source_name": "Referral", "source_description": "Leads from referrals"},
            {"lead_source_name": "Cold Calling", "source_description": "Leads from cold calling campaigns"},
            {"lead_source_name": "Email Campaign", "source_description": "Leads from email marketing"},
            {"lead_source_name": "Social Media", "source_description": "Leads from social media platforms"},
            {"lead_source_name": "Trade Show", "source_description": "Leads from trade shows and events"},
            {"lead_source_name": "Partner", "source_description": "Leads from business partners"},
            {"lead_source_name": "Advertisement", "source_description": "Leads from advertisements"}
        ]
        for source_data in lead_sources:
            existing = await db.lead_source_master.find_one({"lead_source_name": source_data["lead_source_name"], "is_deleted": False})
            if not existing:
                source = LeadSourceMaster(**source_data)
                await db.lead_source_master.insert_one(source.dict())
        
        print("Lead Management master data initialized successfully")
        
    except Exception as e:
        print(f"Error initializing Lead Management master data: {str(e)}")

# Initialize comprehensive qualification rules (38 rules)
async def initialize_qualification_rules():
    """Initialize the 38 comprehensive qualification checklist rules"""
    try:
        # Define the 38 qualification rules covering all aspects
        qualification_rules = [
            # Category: Opportunity-Lead Linkage (QR001-QR003)
            {
                "rule_code": "QR001",
                "rule_name": "Lead-Opportunity Link Validation",
                "rule_description": "Verify opportunity is properly linked to an approved lead with valid lead ID",
                "category": "Opportunity",
                "opportunity_type": "Both",
                "sequence_order": 1,
                "validation_logic": '{"type": "foreign_key", "table": "leads", "field": "lead_id", "status": "approved"}'
            },
            {
                "rule_code": "QR002", 
                "rule_name": "Lead Data Consistency Check",
                "rule_description": "Ensure opportunity data is consistent with linked lead information",
                "category": "Opportunity",
                "opportunity_type": "Both",
                "sequence_order": 2,
                "validation_logic": '{"type": "data_consistency", "fields": ["company_id", "project_title", "expected_revenue"]}'
            },
            {
                "rule_code": "QR003",
                "rule_name": "Opportunity Title Validation", 
                "rule_description": "Opportunity title must be meaningful, unique, and ≤255 characters",
                "category": "Opportunity",
                "opportunity_type": "Both",
                "sequence_order": 3,
                "validation_logic": '{"type": "text_validation", "min_length": 10, "max_length": 255, "unique": true}'
            },
            
            # Category: Company Validation (QR004-QR008)
            {
                "rule_code": "QR004",
                "rule_name": "Company Legal Validation",
                "rule_description": "Verify company exists in master with valid registration details",
                "category": "Company",
                "opportunity_type": "Both", 
                "sequence_order": 4,
                "validation_logic": '{"type": "foreign_key", "table": "companies", "field": "company_id", "required": true}'
            },
            {
                "rule_code": "QR005",
                "rule_name": "GST Number Validation",
                "rule_description": "Company must have valid GST number in correct format (15 digits)",
                "category": "Company",
                "opportunity_type": "Both",
                "sequence_order": 5,
                "validation_logic": '{"type": "regex", "pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", "field": "gst_no"}'
            },
            {
                "rule_code": "QR006",
                "rule_name": "PAN Number Validation", 
                "rule_description": "Company must have valid PAN number in correct format (10 characters)",
                "category": "Company",
                "opportunity_type": "Both",
                "sequence_order": 6,
                "validation_logic": '{"type": "regex", "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", "field": "pan_no"}'
            },
            {
                "rule_code": "QR007",
                "rule_name": "Company Financial Standing",
                "rule_description": "Verify company financial stability and creditworthiness",
                "category": "Company",
                "opportunity_type": "Both",
                "sequence_order": 7,
                "validation_logic": '{"type": "document_required", "document_type": "Financial Statement", "max_age_months": 12}'
            },
            {
                "rule_code": "QR008",
                "rule_name": "Company Business License",
                "rule_description": "Company must have valid business license and regulatory approvals",
                "category": "Company", 
                "opportunity_type": "Both",
                "sequence_order": 8,
                "validation_logic": '{"type": "document_required", "document_type": "Business License", "status": "active"}'
            },
            
            # Category: Customer Discovery (QR009-QR015)
            {
                "rule_code": "QR009",
                "rule_name": "Customer Needs Assessment",
                "rule_description": "Document comprehensive customer needs analysis and requirements",
                "category": "Discovery",
                "opportunity_type": "Both",
                "sequence_order": 9,
                "validation_logic": '{"type": "text_required", "field": "needs_assessment", "min_length": 100}'
            },
            {
                "rule_code": "QR010",
                "rule_name": "Customer Pain Points Identification", 
                "rule_description": "Identify and document key customer pain points and challenges",
                "category": "Discovery",
                "opportunity_type": "Both",
                "sequence_order": 10,
                "validation_logic": '{"type": "list_required", "field": "pain_points", "min_items": 3}'
            },
            {
                "rule_code": "QR011",
                "rule_name": "Customer Budget Confirmation",
                "rule_description": "Confirm customer has allocated budget for the project",
                "category": "Discovery",
                "opportunity_type": "Both", 
                "sequence_order": 11,
                "validation_logic": '{"type": "boolean_required", "field": "budget_confirmed", "value": true}'
            },
            {
                "rule_code": "QR012",
                "rule_name": "Customer Timeline Validation",
                "rule_description": "Validate realistic project timeline with customer expectations",
                "category": "Discovery",
                "opportunity_type": "Both",
                "sequence_order": 12,
                "validation_logic": '{"type": "date_range", "start_field": "project_start_date", "end_field": "project_end_date", "min_duration_days": 30}'
            },
            {
                "rule_code": "QR013",
                "rule_name": "Customer Objection Handling",
                "rule_description": "Document and address all customer objections systematically",
                "category": "Discovery",
                "opportunity_type": "Both",
                "sequence_order": 13,
                "validation_logic": '{"type": "objection_log", "field": "objections_log", "status": "addressed"}'
            },
            {
                "rule_code": "QR014",
                "rule_name": "Risk Assessment Documentation",
                "rule_description": "Identify, assess, and document project and business risks",
                "category": "Discovery",
                "opportunity_type": "Both",
                "sequence_order": 14,
                "validation_logic": '{"type": "risk_matrix", "field": "risk_assessment", "min_risks": 5}'
            },
            {
                "rule_code": "QR015",
                "rule_name": "Solution Fit Validation",
                "rule_description": "Validate our solution aligns with customer requirements",
                "category": "Discovery",
                "opportunity_type": "Both",
                "sequence_order": 15,
                "validation_logic": '{"type": "fit_analysis", "field": "solution_fit", "min_score": 75}'
            },
            
            # Category: Competitor Analysis (QR016-QR020)
            {
                "rule_code": "QR016",
                "rule_name": "Competitor Identification",
                "rule_description": "Identify all direct and indirect competitors in the opportunity",
                "category": "Competitor",
                "opportunity_type": "Both",
                "sequence_order": 16,
                "validation_logic": '{"type": "list_required", "field": "competitors", "min_items": 1}'
            },
            {
                "rule_code": "QR017",
                "rule_name": "Competitor Strength Analysis", 
                "rule_description": "Analyze competitor strengths, weaknesses, and positioning",
                "category": "Competitor",
                "opportunity_type": "Both",
                "sequence_order": 17,
                "validation_logic": '{"type": "competitor_analysis", "field": "competitor_swot", "required_fields": ["strengths", "weaknesses", "threats"]}'
            },
            {
                "rule_code": "QR018",
                "rule_name": "Competitive Pricing Analysis",
                "rule_description": "Research and analyze competitor pricing strategies",
                "category": "Competitor",
                "opportunity_type": "Both",
                "sequence_order": 18,
                "validation_logic": '{"type": "pricing_analysis", "field": "competitive_pricing", "min_competitors": 2}'
            },
            {
                "rule_code": "QR019",
                "rule_name": "Differentiation Strategy",
                "rule_description": "Define clear differentiation strategy against competitors",
                "category": "Competitor",
                "opportunity_type": "Both",
                "sequence_order": 19,
                "validation_logic": '{"type": "text_required", "field": "differentiation_strategy", "min_length": 200}'
            },
            {
                "rule_code": "QR020",
                "rule_name": "Win Strategy Documentation",
                "rule_description": "Document comprehensive strategy to win against competition",
                "category": "Competitor", 
                "opportunity_type": "Both",
                "sequence_order": 20,
                "validation_logic": '{"type": "win_strategy", "field": "win_strategy", "required_elements": ["value_prop", "pricing", "timeline"]}'
            },
            
            # Category: Stakeholder Mapping (QR021-QR025)
            {
                "rule_code": "QR021",
                "rule_name": "Key Stakeholders Identification",
                "rule_description": "Identify all key stakeholders involved in decision making",
                "category": "Stakeholder",
                "opportunity_type": "Both",
                "sequence_order": 21,
                "validation_logic": '{"type": "contacts_required", "field": "opportunity_contacts", "min_contacts": 2}'
            },
            {
                "rule_code": "QR022",
                "rule_name": "Decision Makers Mapping",
                "rule_description": "Map decision makers with their influence levels and percentages",
                "category": "Stakeholder",
                "opportunity_type": "Both",
                "sequence_order": 22,
                "validation_logic": '{"type": "decision_makers", "field": "decision_makers", "min_decision_makers": 1, "total_percentage": 100}'
            },
            {
                "rule_code": "QR023",
                "rule_name": "Stakeholder Influence Analysis",
                "rule_description": "Analyze stakeholder influence levels and relationships",
                "category": "Stakeholder",
                "opportunity_type": "Both",
                "sequence_order": 23,
                "validation_logic": '{"type": "influence_matrix", "field": "stakeholder_influence", "required_levels": ["High", "Medium", "Low"]}'
            },
            {
                "rule_code": "QR024",
                "rule_name": "Champion Identification",
                "rule_description": "Identify and secure internal champion within customer organization",
                "category": "Stakeholder",
                "opportunity_type": "Both",
                "sequence_order": 24,
                "validation_logic": '{"type": "champion_required", "field": "internal_champion", "status": "confirmed"}'
            },
            {
                "rule_code": "QR025",
                "rule_name": "Stakeholder Buy-in Validation",
                "rule_description": "Validate stakeholder buy-in and support for the solution",
                "category": "Stakeholder",
                "opportunity_type": "Both",
                "sequence_order": 25,
                "validation_logic": '{"type": "stakeholder_approval", "field": "stakeholder_buyin", "min_approval_percentage": 70}'
            },
            
            # Category: Technical & Commercial (QR026-QR032)
            {
                "rule_code": "QR026",
                "rule_name": "Technical Requirements Validation",
                "rule_description": "Validate all technical requirements are documented and feasible",
                "category": "Technical",
                "opportunity_type": "Both",
                "sequence_order": 26,
                "validation_logic": '{"type": "technical_spec", "field": "technical_requirements", "completeness": 90}'
            },
            {
                "rule_code": "QR027",
                "rule_name": "BOM Preparation and Approval",
                "rule_description": "Prepare detailed Bill of Materials with cost breakdown",
                "category": "Technical",
                "opportunity_type": "Both",
                "sequence_order": 27,
                "validation_logic": '{"type": "bom_required", "field": "bill_of_materials", "status": "approved"}'
            },
            {
                "rule_code": "QR028",
                "rule_name": "Resource Allocation Planning", 
                "rule_description": "Plan and allocate required resources (human, technical, financial)",
                "category": "Technical",
                "opportunity_type": "Both",
                "sequence_order": 28,
                "validation_logic": '{"type": "resource_plan", "field": "resource_allocation", "required_types": ["human", "technical", "financial"]}'
            },
            {
                "rule_code": "QR029",
                "rule_name": "Revenue Model Validation",
                "rule_description": "Validate revenue model and pricing strategy alignment",
                "category": "Commercial",
                "opportunity_type": "Both",
                "sequence_order": 29,
                "validation_logic": '{"type": "revenue_model", "field": "revenue_model", "min_margin_percentage": 15}'
            },
            {
                "rule_code": "QR030",
                "rule_name": "Profitability Analysis",
                "rule_description": "Conduct comprehensive profitability analysis with minimum 9% margin",
                "category": "Commercial",
                "opportunity_type": "Both",
                "sequence_order": 30,
                "validation_logic": '{"type": "profitability", "field": "profitability_analysis", "min_margin": 9}'
            },
            {
                "rule_code": "QR031",
                "rule_name": "Payment Terms Negotiation",
                "rule_description": "Negotiate and finalize acceptable payment terms and conditions",
                "category": "Commercial",
                "opportunity_type": "Both",
                "sequence_order": 31,
                "validation_logic": '{"type": "payment_terms", "field": "payment_terms", "max_credit_days": 90}'
            },
            {
                "rule_code": "QR032",
                "rule_name": "Contract Terms Validation",
                "rule_description": "Validate contract terms including SLA, penalties, and deliverables",
                "category": "Commercial",
                "opportunity_type": "Both",
                "sequence_order": 32,
                "validation_logic": '{"type": "contract_terms", "field": "contract_terms", "required_clauses": ["SLA", "penalties", "deliverables"]}'
            },
            
            # Category: Documentation & Compliance (QR033-QR036)
            {
                "rule_code": "QR033",
                "rule_name": "Proof Document Upload",
                "rule_description": "Upload all required proof documents with proper versioning",
                "category": "Documentation",
                "opportunity_type": "Both",
                "sequence_order": 33,
                "validation_logic": '{"type": "documents_required", "field": "proof_documents", "min_documents": 5, "versioning": true}'
            },
            {
                "rule_code": "QR034",
                "rule_name": "Compliance Documentation",
                "rule_description": "Ensure all compliance and regulatory documentation is complete",
                "category": "Documentation",
                "opportunity_type": "Both",
                "sequence_order": 34,
                "validation_logic": '{"type": "compliance_docs", "field": "compliance_documentation", "status": "approved"}'
            },
            {
                "rule_code": "QR035",
                "rule_name": "Legal Review Completion",
                "rule_description": "Complete legal review of all contract terms and conditions",
                "category": "Documentation",
                "opportunity_type": "Both",
                "sequence_order": 35,
                "validation_logic": '{"type": "legal_review", "field": "legal_review", "status": "approved", "reviewer_role": "legal"}'
            },
            {
                "rule_code": "QR036",
                "rule_name": "Final Proposal Approval",
                "rule_description": "Obtain final proposal approval from authorized stakeholders", 
                "category": "Documentation",
                "opportunity_type": "Both",
                "sequence_order": 36,
                "validation_logic": '{"type": "proposal_approval", "field": "proposal_approval", "required_approvers": ["sales_manager", "sales_head"]}'
            },
            
            # Category: Tender-Specific Rules (QR037-QR038)
            {
                "rule_code": "QR037",
                "rule_name": "Tender Documentation Compliance",
                "rule_description": "Ensure all tender documentation meets specified requirements and formats",
                "category": "Tender",
                "opportunity_type": "Tender",
                "sequence_order": 37,
                "validation_logic": '{"type": "tender_compliance", "field": "tender_documentation", "compliance_percentage": 100}'
            },
            {
                "rule_code": "QR038",
                "rule_name": "Tender Submission Validation",
                "rule_description": "Validate tender submission process and timeline compliance",
                "category": "Tender",
                "opportunity_type": "Tender",
                "sequence_order": 38,
                "validation_logic": '{"type": "tender_submission", "field": "tender_submission", "before_deadline": true, "format_compliance": true}'
            }
        ]
        
        # Insert qualification rules
        for rule_data in qualification_rules:
            existing = await db.qualification_rules.find_one({
                "rule_code": rule_data["rule_code"],
                "is_deleted": False
            })
            if not existing:
                rule = QualificationRule(**rule_data)
                await db.qualification_rules.insert_one(rule.dict())
        
        print("38 Qualification rules initialized successfully")
        
    except Exception as e:
        print(f"Error initializing qualification rules: {str(e)}")

# Initialize default opportunity stages
async def initialize_opportunity_stages():
    """Initialize default opportunity stages"""
    try:
        # Tender Stages (L1-L6, L7+)
        tender_stages = [
            {"stage_name": "Prospect", "stage_code": "L1", "sequence_order": 1},
            {"stage_name": "Qualification", "stage_code": "L2", "sequence_order": 2},
            {"stage_name": "Needs Analysis", "stage_code": "L3", "sequence_order": 3},
            {"stage_name": "Solution Development", "stage_code": "L4", "sequence_order": 4},
            {"stage_name": "Commercial Evaluation", "stage_code": "L5", "sequence_order": 5},
            {"stage_name": "Won", "stage_code": "L6", "sequence_order": 6},
        ]
        
        # Non-Tender Stages (L1-L5, L6+)
        non_tender_stages = [
            {"stage_name": "Qualification", "stage_code": "L1", "sequence_order": 1},
            {"stage_name": "Needs Analysis", "stage_code": "L2", "sequence_order": 2},
            {"stage_name": "Solution Development", "stage_code": "L3", "sequence_order": 3},
            {"stage_name": "Proposal", "stage_code": "L4", "sequence_order": 4},
            {"stage_name": "Won", "stage_code": "L5", "sequence_order": 5},
        ]
        
        # Shared Stages (L7+)
        shared_stages = [
            {"stage_name": "Order Analysis", "stage_code": "L7", "sequence_order": 7},
            {"stage_name": "Sales Head Review", "stage_code": "L8", "sequence_order": 8},
            {"stage_name": "GC Approval", "stage_code": "L9", "sequence_order": 9},
            {"stage_name": "Lost", "stage_code": "LOST", "sequence_order": 100},
            {"stage_name": "Dropped", "stage_code": "DROPPED", "sequence_order": 101},
            {"stage_name": "Partial", "stage_code": "PARTIAL", "sequence_order": 102},
        ]
        
        # Insert Tender stages
        for stage_data in tender_stages:
            existing = await db.opportunity_stages.find_one({
                "stage_code": stage_data["stage_code"],
                "opportunity_type": "Tender",
                "is_deleted": False
            })
            if not existing:
                stage = OpportunityStage(
                    opportunity_type="Tender",
                    **stage_data
                )
                await db.opportunity_stages.insert_one(stage.dict())
        
        # Insert Non-Tender stages
        for stage_data in non_tender_stages:
            existing = await db.opportunity_stages.find_one({
                "stage_code": stage_data["stage_code"],
                "opportunity_type": "Non-Tender",
                "is_deleted": False
            })
            if not existing:
                stage = OpportunityStage(
                    opportunity_type="Non-Tender",
                    **stage_data
                )
                await db.opportunity_stages.insert_one(stage.dict())
        
        # Insert Shared stages
        for stage_data in shared_stages:
            existing = await db.opportunity_stages.find_one({
                "stage_code": stage_data["stage_code"],
                "opportunity_type": "Shared",
                "is_deleted": False
            })
            if not existing:
                stage = OpportunityStage(
                    opportunity_type="Shared",
                    **stage_data
                )
                await db.opportunity_stages.insert_one(stage.dict())
        
        print("Opportunity stages initialized successfully")
        
    except Exception as e:
        print(f"Error initializing opportunity stages: {str(e)}")

# Opportunity CRUD Endpoints
@api_router.get("/opportunities", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunities(current_user: User = Depends(get_current_user)):
    """Get all opportunities with enriched data"""
    try:
        # Run auto-conversion check
        await check_and_convert_old_leads()
        
        # Get opportunities with enriched data
        pipeline = [
            {"$match": {"is_deleted": False}},
            # Lookup company
            {"$lookup": {
                "from": "companies",
                "localField": "company_id",
                "foreignField": "company_id",
                "as": "company"
            }},
            {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
            # Lookup current stage
            {"$lookup": {
                "from": "opportunity_stages",
                "localField": "current_stage_id",
                "foreignField": "id",
                "as": "current_stage"
            }},
            {"$unwind": {"path": "$current_stage", "preserveNullAndEmptyArrays": True}},
            # Lookup opportunity owner
            {"$lookup": {
                "from": "users",
                "localField": "opportunity_owner_id",
                "foreignField": "id",
                "as": "owner"
            }},
            {"$unwind": {"path": "$owner", "preserveNullAndEmptyArrays": True}},
            # Lookup currency
            {"$lookup": {
                "from": "master_currencies",
                "localField": "revenue_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            # Lookup linked lead
            {"$lookup": {
                "from": "leads",
                "localField": "lead_id",
                "foreignField": "id",
                "as": "linked_lead"
            }},
            {"$unwind": {"path": "$linked_lead", "preserveNullAndEmptyArrays": True}},
            # Add enriched fields
            {"$addFields": {
                "company_name": "$company.company_name",
                "current_stage_name": "$current_stage.stage_name",
                "current_stage_code": "$current_stage.stage_code",
                "owner_name": "$owner.name",
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol",
                "linked_lead_id": "$linked_lead.lead_id"
            }},
            {"$sort": {"created_at": -1}}
        ]
        
        opportunities_cursor = db.opportunities.aggregate(pipeline)
        opportunities = await opportunities_cursor.to_list(1000)
        
        # Remove MongoDB _id field and nested objects
        for opp in opportunities:
            opp.pop("_id", None)
            opp.pop("company", None)
            opp.pop("current_stage", None)
            opp.pop("owner", None)
            opp.pop("currency", None)
            opp.pop("linked_lead", None)
        
        return APIResponse(success=True, message="Opportunities retrieved successfully", data=opportunities)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities", response_model=APIResponse)
@require_permission("/opportunities", "create")
async def create_opportunity(opportunity_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new opportunity (only from approved leads)"""
    try:
        # Check if lead_id is provided and lead is approved
        lead_id = opportunity_data.get("lead_id")
        if not lead_id:
            raise HTTPException(status_code=400, detail="Lead ID is required for opportunity creation")
        
        # Verify lead exists and is approved
        lead = await db.leads.find_one({"id": lead_id, "is_deleted": False})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        if lead.get("approval_status") != "approved":
            raise HTTPException(status_code=400, detail="Opportunity can only be created from approved leads")
        
        # Check if opportunity already exists for this lead
        existing_opp = await db.opportunities.find_one({"lead_id": lead_id, "is_deleted": False})
        if existing_opp:
            raise HTTPException(status_code=400, detail="Opportunity already exists for this lead")
        
        # Generate Opportunity ID and SR Number
        opp_id = await generate_opportunity_id()
        sr_no = await get_next_sr_no()
        
        opportunity_data["opportunity_id"] = opp_id
        opportunity_data["sr_no"] = sr_no
        opportunity_data["created_by"] = current_user.id
        opportunity_data["updated_by"] = current_user.id
        
        # Auto-pull data from lead if not provided
        if not opportunity_data.get("opportunity_title"):
            opportunity_data["opportunity_title"] = lead.get("project_title", "Opportunity from Lead")
        if not opportunity_data.get("company_id"):
            opportunity_data["company_id"] = lead.get("company_id")
        if not opportunity_data.get("opportunity_owner_id"):
            opportunity_data["opportunity_owner_id"] = lead.get("assigned_to_user_id")
        
        # Set default opportunity type based on lead subtype
        if not opportunity_data.get("opportunity_type"):
            lead_subtype = await db.lead_subtype_master.find_one({
                "id": lead.get("lead_subtype_id"),
                "is_deleted": False
            })
            opportunity_data["opportunity_type"] = "Tender" if (lead_subtype and lead_subtype.get("lead_subtype_name") in ["Tender", "Pretender"]) else "Non-Tender"
        
        # Set initial stage
        if not opportunity_data.get("current_stage_id"):
            initial_stage = await db.opportunity_stages.find_one({
                "opportunity_type": opportunity_data["opportunity_type"],
                "sequence_order": 1,
                "is_deleted": False
            })
            if not initial_stage:
                await initialize_opportunity_stages()
                initial_stage = await db.opportunity_stages.find_one({
                    "opportunity_type": opportunity_data["opportunity_type"],
                    "sequence_order": 1,
                    "is_deleted": False
                })
            if initial_stage:
                opportunity_data["current_stage_id"] = initial_stage["id"]
        
        # Auto-pull additional data from lead
        opportunity_data.update({
            "project_title": lead.get("project_title"),
            "project_description": lead.get("project_description"),
            "project_start_date": lead.get("project_start_date"),
            "project_end_date": lead.get("project_end_date"),
            "expected_revenue": lead.get("expected_revenue"),
            "revenue_currency_id": lead.get("revenue_currency_id"),
            "lead_source_id": lead.get("lead_source_id"),
            "decision_maker_percentage": lead.get("decision_maker_percentage")
        })
        
        # Validate opportunity data
        opportunity = Opportunity(**opportunity_data)
        
        # Validate foreign keys
        # Company validation
        company = await db.companies.find_one({"company_id": opportunity.company_id, "is_deleted": False})
        if not company:
            raise HTTPException(status_code=400, detail="Company not found")
        
        # Owner validation
        owner = await db.users.find_one({"id": opportunity.opportunity_owner_id, "is_deleted": False})
        if not owner:
            raise HTTPException(status_code=400, detail="Opportunity owner not found")
        
        # Insert opportunity
        await db.opportunities.insert_one(opportunity.dict())
        
        # Create initial stage history entry
        if opportunity.current_stage_id:
            stage = await db.opportunity_stages.find_one({"id": opportunity.current_stage_id})
            if stage:
                stage_history = OpportunityStageHistory(
                    opportunity_id=opportunity.id,
                    to_stage_id=opportunity.current_stage_id,
                    stage_name=stage["stage_name"],
                    transitioned_by=current_user.id,
                    transition_comments="Initial opportunity creation"
                )
                await db.opportunity_stage_history.insert_one(stage_history.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created opportunity: {opportunity.opportunity_title} ({opp_id})"))
        
        return APIResponse(success=True, message="Opportunity created successfully", data={"opportunity_id": opp_id, "sr_no": sr_no})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PHASE 4: GOVERNANCE & REPORTING APIs (Specific Routes) =====

# Analytics and KPI Endpoints
@api_router.get("/opportunities/analytics", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_analytics(
    period: str = "monthly",  # daily, weekly, monthly, quarterly, yearly
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive opportunity analytics and KPIs"""
    try:
        # Set default date range if not provided
        if not start_date or not end_date:
            end_date_obj = datetime.now(timezone.utc)
            if period == "monthly":
                start_date_obj = end_date_obj.replace(day=1)
            elif period == "quarterly":
                quarter_start_month = ((end_date_obj.month - 1) // 3) * 3 + 1
                start_date_obj = end_date_obj.replace(month=quarter_start_month, day=1)
            elif period == "yearly":
                start_date_obj = end_date_obj.replace(month=1, day=1)
            else:  # weekly or daily
                start_date_obj = end_date_obj - timedelta(days=30)
        else:
            start_date_obj = datetime.fromisoformat(start_date)
            end_date_obj = datetime.fromisoformat(end_date)
        
        # Get opportunities in the date range
        opportunities_cursor = db.opportunities.find({
            "created_at": {"$gte": start_date_obj, "$lte": end_date_obj},
            "is_deleted": False
        })
        opportunities = await opportunities_cursor.to_list(1000)
        
        # Calculate metrics
        total_opportunities = len(opportunities)
        new_opportunities = total_opportunities
        
        # Won/Lost opportunities (based on stage)
        won_opportunities = 0
        lost_opportunities = 0
        total_pipeline_value = 0.0
        won_revenue = 0.0
        lost_revenue = 0.0
        
        stage_distribution = {}
        sales_cycles = []
        
        for opp in opportunities:
            # Calculate pipeline value
            if opp.get("expected_revenue"):
                total_pipeline_value += float(opp["expected_revenue"])
            
            # Get current stage
            current_stage = await db.opportunity_stages.find_one({"id": opp.get("current_stage_id")})
            if current_stage:
                stage_name = current_stage.get("stage_name", "Unknown")
                stage_distribution[stage_name] = stage_distribution.get(stage_name, 0) + 1
                
                # Check if Won or Lost
                if stage_name == "Won":
                    won_opportunities += 1
                    if opp.get("expected_revenue"):
                        won_revenue += float(opp["expected_revenue"])
                elif stage_name in ["Lost", "Dropped"]:
                    lost_opportunities += 1
                    if opp.get("expected_revenue"):
                        lost_revenue += float(opp["expected_revenue"])
            
            # Calculate sales cycle
            if opp.get("created_at") and current_stage and stage_name == "Won":
                # Get stage history to find when it was won
                stage_history = await db.opportunity_stage_history.find_one({
                    "opportunity_id": opp["id"],
                    "stage_name": "Won"
                })
                if stage_history:
                    cycle_days = (stage_history["transition_date"] - opp["created_at"]).days
                    sales_cycles.append(cycle_days)
        
        # Calculate derived metrics
        closed_opportunities = won_opportunities + lost_opportunities
        win_rate = (won_opportunities / closed_opportunities * 100) if closed_opportunities > 0 else 0
        loss_rate = (lost_opportunities / closed_opportunities * 100) if closed_opportunities > 0 else 0
        average_deal_size = total_pipeline_value / total_opportunities if total_opportunities > 0 else 0
        average_sales_cycle = sum(sales_cycles) / len(sales_cycles) if sales_cycles else 0
        
        # Get qualification metrics
        qualification_cursor = db.opportunity_qualifications.find({
            "created_at": {"$gte": start_date_obj, "$lte": end_date_obj}
        })
        qualifications = await qualification_cursor.to_list(1000)
        
        completed_qualifications = len([q for q in qualifications if q.get("compliance_status") in ["compliant", "exempted"]])
        qualification_completion_rate = (completed_qualifications / len(qualifications) * 100) if qualifications else 0
        
        # Create analytics response
        analytics_data = {
            "period": period,
            "period_start": start_date_obj.isoformat(),
            "period_end": end_date_obj.isoformat(),
            "total_opportunities": total_opportunities,
            "new_opportunities": new_opportunities,
            "closed_opportunities": closed_opportunities,
            "won_opportunities": won_opportunities,
            "lost_opportunities": lost_opportunities,
            "total_pipeline_value": round(total_pipeline_value, 2),
            "won_revenue": round(won_revenue, 2),
            "lost_revenue": round(lost_revenue, 2),
            "average_deal_size": round(average_deal_size, 2),
            "win_rate": round(win_rate, 2),
            "loss_rate": round(loss_rate, 2),
            "average_sales_cycle": round(average_sales_cycle),
            "qualification_completion_rate": round(qualification_completion_rate, 2),
            "stage_distribution": stage_distribution,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        return APIResponse(success=True, message="Analytics generated successfully", data=analytics_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/opportunities/kpis", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_kpis(current_user: User = Depends(get_current_user)):
    """Get all opportunity KPIs with current values"""
    try:
        # Get current period analytics for KPI calculation
        analytics_response = await get_opportunity_analytics("monthly", None, None, current_user)
        analytics_data = analytics_response.data
        
        # Define standard KPIs with targets
        kpis = [
            {
                "kpi_name": "Win Rate",
                "kpi_code": "WIN_RATE",
                "kpi_category": "performance",
                "kpi_description": "Percentage of opportunities won vs total closed opportunities",
                "target_value": 25.0,  # 25% target win rate
                "actual_value": analytics_data.get("win_rate", 0),
                "unit": "%"
            },
            {
                "kpi_name": "Average Deal Size",
                "kpi_code": "AVG_DEAL_SIZE",
                "kpi_category": "performance",
                "kpi_description": "Average value of opportunities in pipeline",
                "target_value": 500000.0,  # 5L target average deal size
                "actual_value": analytics_data.get("average_deal_size", 0),
                "unit": "INR"
            },
            {
                "kpi_name": "Sales Cycle Time",
                "kpi_code": "SALES_CYCLE",
                "kpi_category": "efficiency",
                "kpi_description": "Average number of days from opportunity creation to closure",
                "target_value": 90.0,  # 90 days target
                "actual_value": analytics_data.get("average_sales_cycle", 0),
                "unit": "days"
            },
            {
                "kpi_name": "Qualification Completion Rate",
                "kpi_code": "QUAL_COMPLETION",
                "kpi_category": "quality",
                "kpi_description": "Percentage of opportunities with completed qualification",
                "target_value": 95.0,  # 95% target
                "actual_value": analytics_data.get("qualification_completion_rate", 0),
                "unit": "%"
            },
            {
                "kpi_name": "Pipeline Value",
                "kpi_code": "PIPELINE_VALUE",
                "kpi_category": "performance",
                "kpi_description": "Total value of all active opportunities",
                "target_value": 10000000.0,  # 1Cr target pipeline
                "actual_value": analytics_data.get("total_pipeline_value", 0),
                "unit": "INR"
            }
        ]
        
        # Calculate variance and performance status for each KPI
        for kpi in kpis:
            kpi["variance"] = kpi["actual_value"] - kpi["target_value"]
            kpi["variance_percentage"] = (kpi["variance"] / kpi["target_value"] * 100) if kpi["target_value"] != 0 else 0
            
            # Determine performance status
            variance_pct = abs(kpi["variance_percentage"])
            if kpi["actual_value"] >= kpi["target_value"]:
                kpi["performance_status"] = "exceeded" if variance_pct > 10 else "on_track"
            else:
                if variance_pct <= 5:
                    kpi["performance_status"] = "on_track"
                elif variance_pct <= 15:
                    kpi["performance_status"] = "at_risk"
                else:
                    kpi["performance_status"] = "critical"
            
            # Add period information
            kpi["period_start"] = analytics_data["period_start"]
            kpi["period_end"] = analytics_data["period_end"]
            kpi["calculated_at"] = datetime.now(timezone.utc).isoformat()
        
        return APIResponse(success=True, message="KPIs calculated successfully", data=kpis)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Team Performance and Reporting
@api_router.get("/opportunities/team-performance", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_team_performance(current_user: User = Depends(get_current_user)):
    """Get team performance metrics"""
    try:
        # Get all opportunities with owner information
        pipeline = [
            {"$match": {"is_deleted": False}},
            {"$lookup": {
                "from": "users",
                "localField": "opportunity_owner_id",
                "foreignField": "id",
                "as": "owner"
            }},
            {"$unwind": {"path": "$owner", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "opportunity_stages",
                "localField": "current_stage_id",
                "foreignField": "id",
                "as": "current_stage"
            }},
            {"$unwind": {"path": "$current_stage", "preserveNullAndEmptyArrays": True}},
            {"$group": {
                "_id": "$opportunity_owner_id",
                "owner_name": {"$first": "$owner.name"},
                "owner_email": {"$first": "$owner.email"},
                "total_opportunities": {"$sum": 1},
                "total_pipeline_value": {"$sum": "$expected_revenue"},
                "won_opportunities": {
                    "$sum": {
                        "$cond": [{"$eq": ["$current_stage.stage_name", "Won"]}, 1, 0]
                    }
                },
                "won_revenue": {
                    "$sum": {
                        "$cond": [{"$eq": ["$current_stage.stage_name", "Won"]}, "$expected_revenue", 0]
                    }
                }
            }},
            {"$addFields": {
                "win_rate": {
                    "$cond": [
                        {"$gt": ["$total_opportunities", 0]},
                        {"$multiply": [{"$divide": ["$won_opportunities", "$total_opportunities"]}, 100]},
                        0
                    ]
                },
                "average_deal_size": {
                    "$cond": [
                        {"$gt": ["$total_opportunities", 0]},
                        {"$divide": ["$total_pipeline_value", "$total_opportunities"]},
                        0
                    ]
                }
            }},
            {"$sort": {"won_revenue": -1}}
        ]
        
        performance_cursor = db.opportunities.aggregate(pipeline)
        team_performance = await performance_cursor.to_list(100)
        
        # Remove MongoDB _id field
        for performance in team_performance:
            performance["user_id"] = performance.pop("_id")
        
        # Calculate team totals
        total_team_opportunities = sum(p["total_opportunities"] for p in team_performance)
        total_team_pipeline = sum(p["total_pipeline_value"] or 0 for p in team_performance)
        total_team_won = sum(p["won_opportunities"] for p in team_performance)
        total_team_won_revenue = sum(p["won_revenue"] or 0 for p in team_performance)
        
        team_summary = {
            "team_performance": team_performance,
            "team_totals": {
                "total_team_members": len(team_performance),
                "total_opportunities": total_team_opportunities,
                "total_pipeline_value": round(total_team_pipeline, 2),
                "total_won_opportunities": total_team_won,
                "total_won_revenue": round(total_team_won_revenue, 2),
                "team_win_rate": round((total_team_won / total_team_opportunities * 100) if total_team_opportunities > 0 else 0, 2)
            }
        }
        
        return APIResponse(success=True, message="Team performance retrieved successfully", data=team_summary)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Enhanced analytics with forecasting (MUST be before parameterized routes)
@api_router.get("/opportunities/enhanced-analytics", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_enhanced_analytics(current_user: User = Depends(get_current_user)):
    """Get enhanced analytics including forecasting and competitor analysis"""
    try:
        # Get all opportunities
        opportunities = await db.opportunities.find({"is_deleted": False}).to_list(None)
        
        # Calculate weighted revenue by stage
        stage_probabilities = {
            "L1": 10, "L2": 25, "L3": 40, "L4": 60, 
            "L5": 75, "L6": 100, "L7": 0, "L8": 0
        }
        
        weighted_revenue = 0
        stage_breakdown = {}
        
        for opp in opportunities:
            stage = opp.get("current_stage_name", "L1")
            probability = stage_probabilities.get(stage, 10)
            revenue = opp.get("expected_revenue", 0)
            weighted_value = revenue * (probability / 100)
            weighted_revenue += weighted_value
            
            if stage not in stage_breakdown:
                stage_breakdown[stage] = {"count": 0, "value": 0, "weighted_value": 0}
            
            stage_breakdown[stage]["count"] += 1
            stage_breakdown[stage]["value"] += revenue
            stage_breakdown[stage]["weighted_value"] += weighted_value
        
        # Calculate win rate
        total_closed = len([o for o in opportunities if o.get("current_stage_name") in ["L6", "L7"]])
        won_count = len([o for o in opportunities if o.get("current_stage_name") == "L6"])
        win_rate = (won_count / total_closed * 100) if total_closed > 0 else 0
        
        # Mock competitor analysis
        competitor_analysis = [
            {"name": "Competitor A", "opportunities": 15, "win_rate": 25},
            {"name": "Competitor B", "opportunities": 12, "win_rate": 30},
            {"name": "Competitor C", "opportunities": 8, "win_rate": 15}
        ]
        
        analytics_data = {
            "weighted_revenue": weighted_revenue,
            "stage_breakdown": stage_breakdown,
            "win_rate": round(win_rate, 1),
            "total_opportunities": len(opportunities),
            "competitor_analysis": competitor_analysis,
            "forecast": {
                "q1": weighted_revenue * 0.3,
                "q2": weighted_revenue * 0.4,
                "q3": weighted_revenue * 0.2,
                "q4": weighted_revenue * 0.1
            }
        }
        
        return APIResponse(success=True, message="Enhanced analytics retrieved successfully", data=analytics_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/opportunities/{opportunity_id}", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get specific opportunity with all related data"""
    try:
        # Get opportunity with enriched data (same pipeline as get_opportunities)
        pipeline = [
            {"$match": {"id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "companies",
                "localField": "company_id",
                "foreignField": "company_id",
                "as": "company"
            }},
            {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "opportunity_stages",
                "localField": "current_stage_id",
                "foreignField": "id",
                "as": "current_stage"
            }},
            {"$unwind": {"path": "$current_stage", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "opportunity_owner_id",
                "foreignField": "id",
                "as": "owner"
            }},
            {"$unwind": {"path": "$owner", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "master_currencies",
                "localField": "revenue_currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "leads",
                "localField": "lead_id",
                "foreignField": "id",
                "as": "linked_lead"
            }},
            {"$unwind": {"path": "$linked_lead", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "company_name": "$company.company_name",
                "current_stage_name": "$current_stage.stage_name",
                "current_stage_code": "$current_stage.stage_code",
                "owner_name": "$owner.name",
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol",
                "linked_lead_id": "$linked_lead.lead_id"
            }}
        ]
        
        opportunities_cursor = db.opportunities.aggregate(pipeline)
        opportunities = await opportunities_cursor.to_list(1)
        
        if not opportunities:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        opportunity = opportunities[0]
        opportunity.pop("_id", None)
        opportunity.pop("company", None)
        opportunity.pop("current_stage", None)
        opportunity.pop("owner", None)
        opportunity.pop("currency", None)
        opportunity.pop("linked_lead", None)
        
        return APIResponse(success=True, message="Opportunity retrieved successfully", data=opportunity)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Auto-conversion endpoint (can be called manually or via cron)
@api_router.post("/opportunities/auto-convert", response_model=APIResponse)
@require_permission("/opportunities", "create")
async def manual_auto_convert_leads(current_user: User = Depends(get_current_user)):
    """Manually trigger auto-conversion of old approved leads"""
    try:
        converted_count = await check_and_convert_old_leads()
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Manual auto-conversion: {converted_count} leads converted to opportunities"))
        
        return APIResponse(success=True, message=f"Auto-conversion completed. {converted_count} leads converted to opportunities.", data={"converted_count": converted_count})
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== STAGE MANAGEMENT & QUALIFICATION APIs =====

# Get opportunity stages for specific opportunity type
@api_router.get("/opportunities/{opportunity_id}/stages", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_stages(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get available stages for specific opportunity type"""
    try:
        # Get opportunity
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get stages for this opportunity type + shared stages
        stages_cursor = db.opportunity_stages.find({
            "$or": [
                {"opportunity_type": opportunity["opportunity_type"]},
                {"opportunity_type": "Shared"}
            ],
            "is_deleted": False
        }).sort("sequence_order", 1)
        
        stages = await stages_cursor.to_list(100)
        
        # Remove MongoDB _id field
        for stage in stages:
            stage.pop("_id", None)
        
        return APIResponse(success=True, message="Opportunity stages retrieved successfully", data=stages)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get stage transition history
@api_router.get("/opportunities/{opportunity_id}/stage-history", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_stage_history(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get stage transition history for opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get stage history with user enrichment
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_active": True}},
            {"$lookup": {
                "from": "users",
                "localField": "transitioned_by",
                "foreignField": "id",
                "as": "transitioned_user"
            }},
            {"$unwind": {"path": "$transitioned_user", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "transitioned_by_name": "$transitioned_user.name"
            }},
            {"$sort": {"transition_date": 1}}
        ]
        
        history_cursor = db.opportunity_stage_history.aggregate(pipeline)
        history = await history_cursor.to_list(100)
        
        # Remove MongoDB _id field and nested objects
        for record in history:
            record.pop("_id", None)
            record.pop("transitioned_user", None)
        
        return APIResponse(success=True, message="Stage history retrieved successfully", data=history)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get qualification rules for opportunity
@api_router.get("/opportunities/{opportunity_id}/qualification-rules", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_qualification_rules(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get qualification rules applicable for specific opportunity"""
    try:
        # Get opportunity
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get applicable rules (opportunity type + "Both")
        rules_cursor = db.qualification_rules.find({
            "$or": [
                {"opportunity_type": opportunity["opportunity_type"]},
                {"opportunity_type": "Both"}
            ],
            "is_active": True,
            "is_deleted": False
        }).sort("sequence_order", 1)
        
        rules = await rules_cursor.to_list(100)
        
        # Get current compliance status for each rule
        for rule in rules:
            rule.pop("_id", None)
            
            # Get compliance status
            compliance = await db.opportunity_qualifications.find_one({
                "opportunity_id": opportunity_id,
                "rule_id": rule["id"],
                "is_active": True
            })
            
            rule["compliance_status"] = compliance.get("compliance_status", "pending") if compliance else "pending"
            rule["compliance_notes"] = compliance.get("compliance_notes", "") if compliance else ""
            rule["reviewed_at"] = compliance.get("reviewed_at") if compliance else None
            rule["exemption_reason"] = compliance.get("exemption_reason", "") if compliance else ""
        
        return APIResponse(success=True, message="Qualification rules retrieved successfully", data=rules)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update qualification rule compliance
@api_router.put("/opportunities/{opportunity_id}/qualification/{rule_id}", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def update_qualification_compliance(
    opportunity_id: str, 
    rule_id: str, 
    compliance_data: dict, 
    current_user: User = Depends(get_current_user)
):
    """Update compliance status for a specific qualification rule"""
    try:
        # Verify opportunity exists and is not approved/closed
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        if opportunity.get("qualification_status") == "completed":
            raise HTTPException(status_code=400, detail="Cannot modify qualification for completed opportunities")
        
        # Verify rule exists
        rule = await db.qualification_rules.find_one({"id": rule_id, "is_deleted": False})
        if not rule:
            raise HTTPException(status_code=404, detail="Qualification rule not found")
        
        # Validate compliance status
        compliance_status = compliance_data.get("compliance_status")
        if compliance_status not in ["pending", "compliant", "non_compliant", "exempted"]:
            raise HTTPException(status_code=400, detail="Invalid compliance status")
        
        # Check if qualification record exists
        existing_qualification = await db.opportunity_qualifications.find_one({
            "opportunity_id": opportunity_id,
            "rule_id": rule_id,
            "is_active": True
        })
        
        update_data = {
            "compliance_status": compliance_status,
            "compliance_notes": compliance_data.get("compliance_notes", ""),
            "evidence_document_path": compliance_data.get("evidence_document_path", ""),
            "reviewed_by": current_user.id,
            "reviewed_at": datetime.now(timezone.utc),
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Handle exemption
        if compliance_status == "exempted":
            update_data["exemption_reason"] = compliance_data.get("exemption_reason", "")
            update_data["exempted_by"] = current_user.id
            update_data["exempted_at"] = datetime.now(timezone.utc)
        
        if existing_qualification:
            # Update existing record
            await db.opportunity_qualifications.update_one(
                {"id": existing_qualification["id"]},
                {"$set": update_data}
            )
        else:
            # Create new qualification record
            qualification = OpportunityQualification(
                opportunity_id=opportunity_id,
                rule_id=rule_id,
                created_by=current_user.id,
                **update_data
            )
            await db.opportunity_qualifications.insert_one(qualification.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id, 
            action=f"Updated qualification rule {rule['rule_code']} for opportunity {opportunity['opportunity_id']}: {compliance_status}"
        ))
        
        return APIResponse(success=True, message="Qualification compliance updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Check qualification completion status
@api_router.get("/opportunities/{opportunity_id}/qualification-status", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def check_qualification_status(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Check overall qualification completion status for opportunity"""
    try:
        # Get opportunity
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get all applicable rules
        rules_cursor = db.qualification_rules.find({
            "$or": [
                {"opportunity_type": opportunity["opportunity_type"]},
                {"opportunity_type": "Both"}
            ],
            "is_mandatory": True,
            "is_active": True,
            "is_deleted": False
        })
        
        mandatory_rules = await rules_cursor.to_list(100)
        total_mandatory = len(mandatory_rules)
        
        if total_mandatory == 0:
            return APIResponse(success=True, message="No mandatory qualification rules", data={
                "qualification_complete": True,
                "completion_percentage": 100,
                "compliant_rules": 0,
                "total_mandatory_rules": 0,
                "pending_rules": [],
                "non_compliant_rules": []
            })
        
        # Check compliance status for each mandatory rule
        compliant_count = 0
        pending_rules = []
        non_compliant_rules = []
        
        for rule in mandatory_rules:
            compliance = await db.opportunity_qualifications.find_one({
                "opportunity_id": opportunity_id,
                "rule_id": rule["id"],
                "is_active": True
            })
            
            if compliance:
                status = compliance.get("compliance_status", "pending")
                if status in ["compliant", "exempted"]:
                    compliant_count += 1
                elif status == "non_compliant":
                    non_compliant_rules.append({
                        "rule_code": rule["rule_code"],
                        "rule_name": rule["rule_name"],
                        "compliance_notes": compliance.get("compliance_notes", "")
                    })
                else:
                    pending_rules.append({
                        "rule_code": rule["rule_code"],
                        "rule_name": rule["rule_name"]
                    })
            else:
                pending_rules.append({
                    "rule_code": rule["rule_code"],
                    "rule_name": rule["rule_name"]
                })
        
        completion_percentage = (compliant_count / total_mandatory) * 100 if total_mandatory > 0 else 100
        qualification_complete = completion_percentage == 100
        
        # Update opportunity qualification status
        if qualification_complete and opportunity.get("qualification_status") != "completed":
            await db.opportunities.update_one(
                {"id": opportunity_id},
                {"$set": {
                    "qualification_status": "completed",
                    "qualification_completed_at": datetime.now(timezone.utc),
                    "qualification_completed_by": current_user.id,
                    "updated_by": current_user.id,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        return APIResponse(success=True, message="Qualification status checked successfully", data={
            "qualification_complete": qualification_complete,
            "completion_percentage": round(completion_percentage, 2),
            "compliant_rules": compliant_count,
            "total_mandatory_rules": total_mandatory,
            "pending_rules": pending_rules,
            "non_compliant_rules": non_compliant_rules
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Stage transition endpoint
@api_router.put("/opportunities/{opportunity_id}/transition-stage", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def transition_opportunity_stage(
    opportunity_id: str, 
    transition_data: dict, 
    current_user: User = Depends(get_current_user)
):
    """Transition opportunity to next stage with validation"""
    try:
        # Get opportunity
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        if opportunity.get("state") == "Closed":
            raise HTTPException(status_code=400, detail="Cannot transition closed opportunity")
        
        # Get target stage
        target_stage_id = transition_data.get("target_stage_id")
        if not target_stage_id:
            raise HTTPException(status_code=400, detail="Target stage ID is required")
        
        target_stage = await db.opportunity_stages.find_one({"id": target_stage_id, "is_deleted": False})
        if not target_stage:
            raise HTTPException(status_code=404, detail="Target stage not found")
        
        # Get current stage
        current_stage = await db.opportunity_stages.find_one({"id": opportunity["current_stage_id"], "is_deleted": False})
        
        # Validate stage transition rules
        # 1. Can't go backwards (except for specific cases)
        if current_stage and target_stage["sequence_order"] < current_stage["sequence_order"]:
            if not transition_data.get("force_backward", False):
                raise HTTPException(status_code=400, detail="Backward stage transition not allowed without force flag")
        
        # 2. Check qualification completion for progression beyond L2/L1
        if target_stage["sequence_order"] > 2:  # Beyond initial qualification stages
            qualification_status = await check_qualification_status(opportunity_id, current_user)
            if not qualification_status.data["qualification_complete"]:
                # Check for executive committee override
                if not transition_data.get("executive_override", False):
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Qualification not complete ({qualification_status.data['completion_percentage']}%). Executive committee override required."
                    )
                
                # Log executive override
                await log_activity(ActivityLog(
                    user_id=current_user.id,
                    action=f"Executive override for stage transition: {opportunity['opportunity_id']} - Qualification incomplete but overridden"
                ))
        
        # 3. Tender-specific validations for L5 (Commercial Evaluation)
        if (target_stage["stage_code"] == "L5" and 
            opportunity["opportunity_type"] == "Tender"):
            # Assign Pretender & Tender Lead (required at L5 for Tender)
            pretender_lead_id = transition_data.get("pretender_lead_id")
            tender_lead_id = transition_data.get("tender_lead_id")
            
            if not pretender_lead_id or not tender_lead_id:
                raise HTTPException(
                    status_code=400, 
                    detail="Pretender Lead and Tender Lead assignment required for Tender L5 stage"
                )
            
            # Validate users exist
            pretender_user = await db.users.find_one({"id": pretender_lead_id, "is_deleted": False})
            tender_user = await db.users.find_one({"id": tender_lead_id, "is_deleted": False})
            
            if not pretender_user or not tender_user:
                raise HTTPException(status_code=400, detail="Invalid Pretender Lead or Tender Lead user")
        
        # 4. Decision makers validation for Proposal/Bid stages
        if target_stage["stage_code"] in ["L4", "L5"]:  # Proposal/Commercial stages
            # Check for minimum 2 decision makers
            decision_makers_count = await db.opportunity_contacts.count_documents({
                "opportunity_id": opportunity_id,
                "is_decision_maker": True,
                "is_active": True,
                "is_deleted": False
            })
            
            if decision_makers_count < 2:
                raise HTTPException(
                    status_code=400,
                    detail="Minimum 2 decision makers required for Proposal/Commercial stages"
                )
        
        # 5. Lock contacts post-Won stage
        if target_stage["stage_code"] in ["L6", "L5"] and target_stage["stage_name"] == "Won":
            # Mark contacts as locked
            await db.opportunity_contacts.update_many(
                {"opportunity_id": opportunity_id, "is_deleted": False},
                {"$set": {
                    "is_locked": True,
                    "locked_at": datetime.now(timezone.utc),
                    "locked_by": current_user.id
                }}
            )
        
        # Update opportunity stage
        update_data = {
            "current_stage_id": target_stage_id,
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.opportunities.update_one({"id": opportunity_id}, {"$set": update_data})
        
        # Create stage history record
        stage_history = OpportunityStageHistory(
            opportunity_id=opportunity_id,
            from_stage_id=opportunity.get("current_stage_id"),
            to_stage_id=target_stage_id,
            stage_name=target_stage["stage_name"],
            transitioned_by=current_user.id,
            transition_comments=transition_data.get("comments", ""),
            pretender_lead_id=transition_data.get("pretender_lead_id"),
            tender_lead_id=transition_data.get("tender_lead_id")
        )
        
        await db.opportunity_stage_history.insert_one(stage_history.dict())
        
        # Log activity
        stage_transition_msg = f"Transitioned opportunity {opportunity['opportunity_id']} to {target_stage['stage_name']} ({target_stage['stage_code']})"
        if transition_data.get("executive_override"):
            stage_transition_msg += " [Executive Override]"
        
        await log_activity(ActivityLog(user_id=current_user.id, action=stage_transition_msg))
        
        return APIResponse(success=True, message=f"Opportunity transitioned to {target_stage['stage_name']} successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PHASE 3: ADVANCED FEATURES APIs =====

# Opportunity Documents Management
@api_router.get("/opportunities/{opportunity_id}/documents", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_documents(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get all documents for a specific opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get documents with enriched data
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "master_document_types",
                "localField": "document_type_id",
                "foreignField": "document_type_id",
                "as": "document_type"
            }},
            {"$unwind": {"path": "$document_type", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "created_by",
                "foreignField": "id",
                "as": "creator"
            }},
            {"$unwind": {"path": "$creator", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "approved_by",
                "foreignField": "id",
                "as": "approver"
            }},
            {"$unwind": {"path": "$approver", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "document_type_name": "$document_type.document_type_name",
                "created_by_name": "$creator.name",
                "approved_by_name": "$approver.name"
            }},
            {"$sort": {"created_at": -1}}
        ]
        
        documents_cursor = db.opportunity_documents.aggregate(pipeline)
        documents = await documents_cursor.to_list(100)
        
        for document in documents:
            document.pop("_id", None)
            document.pop("document_type", None)
            document.pop("creator", None)
            document.pop("approver", None)
        
        return APIResponse(success=True, message="Opportunity documents retrieved successfully", data=documents)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/documents", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_opportunity_document(opportunity_id: str, document_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new document for an opportunity"""
    try:
        # Verify opportunity exists and is not closed
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        if opportunity.get("state") == "Closed":
            raise HTTPException(status_code=400, detail="Cannot add documents to closed opportunity")
        
        document_data["opportunity_id"] = opportunity_id
        document_data["created_by"] = current_user.id
        document_data["updated_by"] = current_user.id
        
        # Check for unique document name + version combination
        existing_doc = await db.opportunity_documents.find_one({
            "opportunity_id": opportunity_id,
            "document_name": document_data["document_name"],
            "version": document_data.get("version", "1.0"),
            "is_deleted": False
        })
        
        if existing_doc:
            raise HTTPException(status_code=400, detail="Document with this name and version already exists")
        
        # Validate document data
        document = OpportunityDocument(**document_data)
        
        # Insert document
        await db.opportunity_documents.insert_one(document.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Added document '{document.document_name}' v{document.version} to opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="Document created successfully", data={"document_id": document.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/opportunities/{opportunity_id}/documents/{document_id}", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def update_opportunity_document(opportunity_id: str, document_id: str, document_data: dict, current_user: User = Depends(get_current_user)):
    """Update an opportunity document"""
    try:
        # Check if document exists and belongs to opportunity
        existing_doc = await db.opportunity_documents.find_one({
            "id": document_id,
            "opportunity_id": opportunity_id,
            "is_deleted": False
        })
        
        if not existing_doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Check if document is final version (read-only)
        if existing_doc.get("is_final_version", False):
            raise HTTPException(status_code=400, detail="Cannot modify final version document")
        
        # Check role-based edit permissions
        if existing_doc.get("can_edit", True) == False:
            raise HTTPException(status_code=403, detail="Document is not editable")
        
        document_data["updated_by"] = current_user.id
        document_data["updated_at"] = datetime.now(timezone.utc)
        
        # Update document
        await db.opportunity_documents.update_one({"id": document_id}, {"$set": document_data})
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Updated document '{existing_doc['document_name']}' in opportunity {opportunity_id}"
        ))
        
        return APIResponse(success=True, message="Document updated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Opportunity Clauses Management
@api_router.get("/opportunities/{opportunity_id}/clauses", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_clauses(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get all clauses for a specific opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get clauses with enriched data
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "users",
                "localField": "reviewed_by",
                "foreignField": "id",
                "as": "reviewer"
            }},
            {"$unwind": {"path": "$reviewer", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "opportunity_documents",
                "localField": "evidence_document_id",
                "foreignField": "id",
                "as": "evidence_document"
            }},
            {"$unwind": {"path": "$evidence_document", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "reviewed_by_name": "$reviewer.name",
                "evidence_document_name": "$evidence_document.document_name"
            }},
            {"$sort": {"created_at": 1}}
        ]
        
        clauses_cursor = db.opportunity_clauses.aggregate(pipeline)
        clauses = await clauses_cursor.to_list(100)
        
        for clause in clauses:
            clause.pop("_id", None)
            clause.pop("reviewer", None)
            clause.pop("evidence_document", None)
        
        return APIResponse(success=True, message="Opportunity clauses retrieved successfully", data=clauses)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/clauses", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_opportunity_clause(opportunity_id: str, clause_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new clause for an opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Check for unique clause type + criteria per opportunity
        existing_clause = await db.opportunity_clauses.find_one({
            "opportunity_id": opportunity_id,
            "clause_type": clause_data["clause_type"],
            "criteria_description": clause_data["criteria_description"],
            "is_deleted": False
        })
        
        if existing_clause:
            raise HTTPException(status_code=400, detail="Clause with this type and criteria already exists")
        
        clause_data["opportunity_id"] = opportunity_id
        clause_data["created_by"] = current_user.id
        clause_data["updated_by"] = current_user.id
        
        # Validate clause data
        clause = OpportunityClause(**clause_data)
        
        # Insert clause
        await db.opportunity_clauses.insert_one(clause.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Added clause '{clause.clause_type}' to opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="Clause created successfully", data={"clause_id": clause.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Important Dates Management (Tender-specific)
@api_router.get("/opportunities/{opportunity_id}/important-dates", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_important_dates(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get all important dates for a specific opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get important dates with user enrichment
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "users",
                "localField": "created_by",
                "foreignField": "id",
                "as": "creator"
            }},
            {"$unwind": {"path": "$creator", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "created_by_name": "$creator.name"
            }},
            {"$sort": {"date_value": 1}}
        ]
        
        dates_cursor = db.opportunity_important_dates.aggregate(pipeline)
        dates = await dates_cursor.to_list(100)
        
        for date in dates:
            date.pop("_id", None)
            date.pop("creator", None)
        
        return APIResponse(success=True, message="Important dates retrieved successfully", data=dates)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/important-dates", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_opportunity_important_date(opportunity_id: str, date_data: dict, current_user: User = Depends(get_current_user)):
    """Create an important date for an opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Important dates are primarily for Tender opportunities
        if opportunity.get("opportunity_type") != "Tender":
            # Allow but warn for Non-Tender
            pass
        
        date_data["opportunity_id"] = opportunity_id
        date_data["created_by"] = current_user.id
        date_data["updated_by"] = current_user.id
        
        # Validate date data and sequence
        important_date = OpportunityImportantDate(**date_data)
        
        # Check sequence validation if required
        # TODO: Implement sequence validation (Tender Publish → Query → Pre-Bid → Submission → Opening → Presentation)
        
        # Insert important date
        await db.opportunity_important_dates.insert_one(important_date.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Added important date '{important_date.date_type}' to opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="Important date created successfully", data={"date_id": important_date.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Won Details Management
@api_router.get("/opportunities/{opportunity_id}/won-details", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_won_details(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get won details for a specific opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get won details with enriched data
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "master_currencies",
                "localField": "currency_id",
                "foreignField": "currency_id",
                "as": "currency"
            }},
            {"$unwind": {"path": "$currency", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "signed_by",
                "foreignField": "id",
                "as": "signer"
            }},
            {"$unwind": {"path": "$signer", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "approved_by",
                "foreignField": "id",
                "as": "approver"
            }},
            {"$unwind": {"path": "$approver", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "currency_code": "$currency.currency_code",
                "currency_symbol": "$currency.symbol",
                "signed_by_name": "$signer.name",
                "approved_by_name": "$approver.name"
            }}
        ]
        
        won_details_cursor = db.opportunity_won_details.aggregate(pipeline)
        won_details = await won_details_cursor.to_list(1)
        
        if won_details:
            won_detail = won_details[0]
            won_detail.pop("_id", None)
            won_detail.pop("currency", None)
            won_detail.pop("signer", None)
            won_detail.pop("approver", None)
        else:
            won_detail = None
        
        return APIResponse(success=True, message="Won details retrieved successfully", data=won_detail)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/won-details", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_opportunity_won_details(opportunity_id: str, won_data: dict, current_user: User = Depends(get_current_user)):
    """Create won details for an opportunity (captured post-Won)"""
    try:
        # Verify opportunity exists and is in Won stage
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get current stage to verify it's Won stage
        current_stage = await db.opportunity_stages.find_one({"id": opportunity["current_stage_id"]})
        if not current_stage or current_stage.get("stage_name") != "Won":
            raise HTTPException(status_code=400, detail="Won details can only be captured for opportunities in Won stage")
        
        # Check if won details already exist
        existing_won = await db.opportunity_won_details.find_one({
            "opportunity_id": opportunity_id,
            "is_deleted": False
        })
        
        if existing_won:
            raise HTTPException(status_code=400, detail="Won details already exist for this opportunity")
        
        # Check for unique quotation ID
        existing_quotation = await db.opportunity_won_details.find_one({
            "quotation_id": won_data["quotation_id"],
            "is_deleted": False
        })
        
        if existing_quotation:
            raise HTTPException(status_code=400, detail="Quotation ID must be unique")
        
        won_data["opportunity_id"] = opportunity_id
        won_data["created_by"] = current_user.id
        won_data["updated_by"] = current_user.id
        
        # Auto-calculate profitability and enforce minimum 9% margin
        if "gross_margin" in won_data and won_data["gross_margin"] is not None:
            won_data["min_margin_compliance"] = won_data["gross_margin"] >= 9.0
        
        # Validate won details data
        won_details = OpportunityWonDetails(**won_data)
        
        # Insert won details
        await db.opportunity_won_details.insert_one(won_details.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Added won details (Quotation: {won_details.quotation_id}) to opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="Won details created successfully", data={"won_details_id": won_details.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Order Analysis Management
@api_router.get("/opportunities/{opportunity_id}/order-analysis", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_order_analysis(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get order analysis for a specific opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get order analysis with enriched data
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "users",
                "localField": "reviewed_by_sales_ops",
                "foreignField": "id",
                "as": "sales_ops_reviewer"
            }},
            {"$unwind": {"path": "$sales_ops_reviewer", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "reviewed_by_sales_manager",
                "foreignField": "id",
                "as": "sales_manager_reviewer"
            }},
            {"$unwind": {"path": "$sales_manager_reviewer", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "approved_by_sales_head",
                "foreignField": "id",
                "as": "sales_head_approver"
            }},
            {"$unwind": {"path": "$sales_head_approver", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "final_approved_by",
                "foreignField": "id",
                "as": "final_approver"
            }},
            {"$unwind": {"path": "$final_approver", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "sales_ops_reviewer_name": "$sales_ops_reviewer.name",
                "sales_manager_reviewer_name": "$sales_manager_reviewer.name",
                "sales_head_approver_name": "$sales_head_approver.name",
                "final_approver_name": "$final_approver.name"
            }}
        ]
        
        analysis_cursor = db.opportunity_order_analysis.aggregate(pipeline)
        analysis = await analysis_cursor.to_list(1)
        
        if analysis:
            order_analysis = analysis[0]
            order_analysis.pop("_id", None)
            # Remove nested objects
            for key in ["sales_ops_reviewer", "sales_manager_reviewer", "sales_head_approver", "final_approver"]:
                order_analysis.pop(key, None)
        else:
            order_analysis = None
        
        return APIResponse(success=True, message="Order analysis retrieved successfully", data=order_analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/order-analysis", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_opportunity_order_analysis(opportunity_id: str, analysis_data: dict, current_user: User = Depends(get_current_user)):
    """Create order analysis for an opportunity (captured post-L7 Order Analysis)"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Check if order analysis already exists
        existing_analysis = await db.opportunity_order_analysis.find_one({
            "opportunity_id": opportunity_id,
            "is_deleted": False
        })
        
        if existing_analysis:
            raise HTTPException(status_code=400, detail="Order analysis already exists for this opportunity")
        
        # Check for unique PO number
        existing_po = await db.opportunity_order_analysis.find_one({
            "po_number": analysis_data["po_number"],
            "is_deleted": False
        })
        
        if existing_po:
            raise HTTPException(status_code=400, detail="PO Number must be unique")
        
        analysis_data["opportunity_id"] = opportunity_id
        analysis_data["created_by"] = current_user.id
        analysis_data["updated_by"] = current_user.id
        
        # Validate order analysis data
        order_analysis = OpportunityOrderAnalysis(**analysis_data)
        
        # Insert order analysis
        await db.opportunity_order_analysis.insert_one(order_analysis.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Added order analysis (PO: {order_analysis.po_number}) to opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="Order analysis created successfully", data={"analysis_id": order_analysis.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# SL Process Tracking
@api_router.get("/opportunities/{opportunity_id}/sl-tracking", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_sl_process_tracking(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get SL (Sales Lifecycle) process tracking for opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get SL tracking activities with enriched data
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_deleted": False}},
            {"$lookup": {
                "from": "opportunity_stages",
                "localField": "stage_id",
                "foreignField": "id",
                "as": "stage"
            }},
            {"$unwind": {"path": "$stage", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "assigned_to",
                "foreignField": "id",
                "as": "assignee"
            }},
            {"$unwind": {"path": "$assignee", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "stage_name": "$stage.stage_name",
                "stage_code": "$stage.stage_code",
                "assigned_to_name": "$assignee.name"
            }},
            {"$sort": {"created_at": 1}}
        ]
        
        tracking_cursor = db.sl_process_tracking.aggregate(pipeline)
        tracking_activities = await tracking_cursor.to_list(100)
        
        for activity in tracking_activities:
            activity.pop("_id", None)
            activity.pop("stage", None)
            activity.pop("assignee", None)
        
        return APIResponse(success=True, message="SL process tracking retrieved successfully", data=tracking_activities)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/sl-tracking", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_sl_process_activity(opportunity_id: str, activity_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new SL process tracking activity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        activity_data["opportunity_id"] = opportunity_id
        activity_data["created_by"] = current_user.id
        activity_data["updated_by"] = current_user.id
        
        # Validate activity data
        sl_activity = SLProcessTracking(**activity_data)
        
        # Insert SL activity
        await db.sl_process_tracking.insert_one(sl_activity.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Added SL activity '{sl_activity.activity_name}' to opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="SL process activity created successfully", data={"activity_id": sl_activity.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PHASE 4: GOVERNANCE & REPORTING APIs =====

# Enhanced Audit Trail
@api_router.get("/opportunities/{opportunity_id}/audit-log", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_audit_log(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get comprehensive audit log for an opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get audit logs with user enrichment
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id}},
            {"$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "id",
                "as": "user"
            }},
            {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "approved_by",
                "foreignField": "id",
                "as": "approver"
            }},
            {"$unwind": {"path": "$approver", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "user_name": "$user.name",
                "user_email": "$user.email",
                "approver_name": "$approver.name"
            }},
            {"$sort": {"action_timestamp": -1}}
        ]
        
        audit_cursor = db.opportunity_audit_log.aggregate(pipeline)
        audit_logs = await audit_cursor.to_list(1000)
        
        for log in audit_logs:
            log.pop("_id", None)
            log.pop("user", None)
            log.pop("approver", None)
        
        # Also get activity logs (existing system)
        activity_logs = await db.activity_logs.find({
            "action": {"$regex": opportunity.get("opportunity_id", ""), "$options": "i"}
        }).sort("created_at", -1).to_list(100)
        
        for log in activity_logs:
            log.pop("_id", None)
        
        audit_data = {
            "opportunity_id": opportunity_id,
            "opportunity_code": opportunity.get("opportunity_id"),
            "detailed_audit_logs": audit_logs,
            "activity_logs": activity_logs,
            "total_audit_entries": len(audit_logs) + len(activity_logs)
        }
        
        return APIResponse(success=True, message="Audit log retrieved successfully", data=audit_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Compliance Monitoring
@api_router.get("/opportunities/{opportunity_id}/compliance", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_compliance(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get compliance status for an opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get compliance records
        compliance_cursor = db.opportunity_compliance.find({
            "opportunity_id": opportunity_id,
            "is_deleted": False
        }).sort("created_at", -1)
        
        compliance_records = await compliance_cursor.to_list(100)
        
        for record in compliance_records:
            record.pop("_id", None)
        
        # Calculate compliance summary
        total_rules = len(compliance_records)
        compliant_rules = len([r for r in compliance_records if r.get("compliance_status") == "compliant"])
        non_compliant_rules = len([r for r in compliance_records if r.get("compliance_status") == "non_compliant"])
        pending_rules = len([r for r in compliance_records if r.get("compliance_status") == "pending"])
        
        compliance_score = (compliant_rules / total_rules * 100) if total_rules > 0 else 100
        
        # Identify high-risk areas
        high_risk_items = [r for r in compliance_records if r.get("risk_level") in ["high", "critical"]]
        
        compliance_summary = {
            "opportunity_id": opportunity_id,
            "total_compliance_rules": total_rules,
            "compliant_rules": compliant_rules,
            "non_compliant_rules": non_compliant_rules,
            "pending_rules": pending_rules,
            "overall_compliance_score": round(compliance_score, 2),
            "high_risk_items": len(high_risk_items),
            "compliance_records": compliance_records,
            "high_risk_details": high_risk_items
        }
        
        return APIResponse(success=True, message="Compliance status retrieved successfully", data=compliance_summary)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Digital Signature Management
@api_router.get("/opportunities/{opportunity_id}/digital-signatures", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_digital_signatures(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get all digital signatures for an opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get digital signatures with user enrichment
        pipeline = [
            {"$match": {"opportunity_id": opportunity_id, "is_active": True}},
            {"$lookup": {
                "from": "users",
                "localField": "signer_id",
                "foreignField": "id",
                "as": "signer"
            }},
            {"$unwind": {"path": "$signer", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {
                "from": "users",
                "localField": "verified_by",
                "foreignField": "id",
                "as": "verifier"
            }},
            {"$unwind": {"path": "$verifier", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "signer_full_name": "$signer.name",
                "verifier_name": "$verifier.name"
            }},
            {"$sort": {"signed_at": -1}}
        ]
        
        signatures_cursor = db.opportunity_digital_signatures.aggregate(pipeline)
        signatures = await signatures_cursor.to_list(100)
        
        for signature in signatures:
            signature.pop("_id", None)
            signature.pop("signer", None)
            signature.pop("verifier", None)
        
        # Summary statistics
        total_signatures = len(signatures)
        verified_signatures = len([s for s in signatures if s.get("is_verified")])
        pending_verification = total_signatures - verified_signatures
        
        signature_summary = {
            "opportunity_id": opportunity_id,
            "total_signatures": total_signatures,
            "verified_signatures": verified_signatures,
            "pending_verification": pending_verification,
            "signatures": signatures
        }
        
        return APIResponse(success=True, message="Digital signatures retrieved successfully", data=signature_summary)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/opportunities/{opportunity_id}/digital-signatures", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_digital_signature(opportunity_id: str, signature_data: dict, current_user: User = Depends(get_current_user)):
    """Create a digital signature record"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        signature_data["opportunity_id"] = opportunity_id
        signature_data["signed_at"] = datetime.now(timezone.utc)
        
        # Validate signature data
        digital_signature = OpportunityDigitalSignature(**signature_data)
        
        # Insert signature record
        await db.opportunity_digital_signatures.insert_one(digital_signature.dict())
        
        # Log activity
        await log_activity(ActivityLog(
            user_id=current_user.id,
            action=f"Digital signature added for {digital_signature.document_type} in opportunity {opportunity['opportunity_id']}"
        ))
        
        return APIResponse(success=True, message="Digital signature recorded successfully", data={"signature_id": digital_signature.id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENHANCED OPPORTUNITY MANAGEMENT ENDPOINTS =====

# Enhanced stage transition with approval workflow
@api_router.post("/opportunities/{opportunity_id}/request-approval", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def request_stage_approval(
    opportunity_id: str, 
    approval_data: dict, 
    current_user: User = Depends(get_current_user)
):
    """Request approval for stage transition"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Create approval request
        approval_request = {
            "id": str(uuid.uuid4()),
            "opportunity_id": opportunity_id,
            "requested_stage": approval_data.get("stage_id"),
            "form_data": approval_data.get("form_data", {}),
            "comments": approval_data.get("comments", ""),
            "status": "pending",
            "requested_by": current_user.id,
            "requested_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await db.opportunity_approvals.insert_one(approval_request)
        
        # Send notification to managers (mock implementation)
        # In real implementation, this would send email/SMS notifications
        
        # Remove MongoDB's _id field and ensure datetime serialization
        response_data = approval_request.copy()
        response_data.pop("_id", None)
        
        # Convert datetime objects to ISO format strings for JSON serialization
        if isinstance(response_data.get("requested_at"), datetime):
            response_data["requested_at"] = response_data["requested_at"].isoformat()
        if isinstance(response_data.get("created_at"), datetime):
            response_data["created_at"] = response_data["created_at"].isoformat()
        
        return APIResponse(success=True, message="Approval request sent successfully", data=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update opportunity stage
@api_router.put("/opportunities/{opportunity_id}/stage", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def update_opportunity_stage(
    opportunity_id: str, 
    stage_data: dict, 
    current_user: User = Depends(get_current_user)
):
    """Update opportunity stage with form data"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Update opportunity stage
        stage_id = stage_data.get("stage_id")
        form_data = stage_data.get("form_data", {})
        
        update_data = {
            "current_stage_id": stage_id,
            "current_stage_name": stage_id,  # For compatibility
            "stage_form_data": form_data,
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Update specific fields based on stage
        if stage_id == "L6":  # Won
            update_data["state"] = "Closed"
            update_data["final_value"] = form_data.get("final_value")
        elif stage_id in ["L7", "L8"]:  # Lost or Dropped
            update_data["state"] = "Closed"
        
        await db.opportunities.update_one(
            {"id": opportunity_id},
            {"$set": update_data}
        )
        
        # Record stage history
        stage_history = {
            "id": str(uuid.uuid4()),
            "opportunity_id": opportunity_id,
            "from_stage_id": opportunity.get("current_stage_id"),
            "to_stage_id": stage_id,
            "stage_name": stage_id,
            "transition_date": datetime.now(timezone.utc),
            "transitioned_by": current_user.id,
            "transition_comments": form_data.get("comments", ""),
            "form_data": form_data
        }
        
        await db.opportunity_stage_history.insert_one(stage_history)
        
        # Auto-initiate Service Delivery if opportunity reaches L6 (Won)
        if stage_id == "L6":
            try:
                await auto_initiate_service_delivery(opportunity_id, current_user.id)
            except Exception as e:
                # Log error but don't fail the stage update
                print(f"Warning: Failed to auto-initiate Service Delivery for opportunity {opportunity_id}: {str(e)}")
        
        return APIResponse(success=True, message="Stage updated successfully", data=update_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get stage-specific form schema
@api_router.get("/opportunities/stage-schema/{stage_id}", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_stage_form_schema(stage_id: str, current_user: User = Depends(get_current_user)):
    """Get form schema for specific stage"""
    try:
        # Define stage schemas (this could be stored in database)
        stage_schemas = {
            "L1": {
                "fields": [
                    {"name": "region", "type": "select", "required": True, "label": "Region"},
                    {"name": "product_interest", "type": "select", "required": True, "label": "Product Interest"},
                    {"name": "assigned_rep", "type": "select", "required": True, "label": "Assigned Rep"},
                    {"name": "status", "type": "select", "required": True, "label": "Status"},
                    {"name": "notes", "type": "textarea", "required": False, "label": "Notes"}
                ]
            },
            "L2": {
                "fields": [
                    {"name": "scorecard", "type": "textarea", "required": True, "label": "BANT/CHAMP Scorecard"},
                    {"name": "qualification_status", "type": "select", "required": True, "label": "Status"},
                    {"name": "go_no_go_checklist", "type": "checklist", "required": True, "label": "Go/No-Go Checklist"}
                ]
            },
            "L3": {
                "fields": [
                    {"name": "proposal_upload", "type": "file", "required": True, "label": "Proposal Upload"},
                    {"name": "version", "type": "text", "required": True, "label": "Version"},
                    {"name": "submission_date", "type": "date", "required": True, "label": "Submission Date"}
                ]
            },
            "L4": {
                "fields": [
                    {"name": "proposal_groups", "type": "multiselect", "required": True, "label": "Groups/Phases"},
                    {"name": "item_selection", "type": "itemselect", "required": True, "label": "Item Selection"},
                    {"name": "quotation_status", "type": "select", "required": True, "label": "Quotation Status"},
                    {"name": "digital_signature", "type": "file", "required": True, "label": "Digital Signature"}
                ]
            },
            "L5": {
                "fields": [
                    {"name": "updated_pricing", "type": "number", "required": True, "label": "Updated Pricing"},
                    {"name": "margin_check", "type": "number", "required": True, "label": "Margin Check (%)"},
                    {"name": "po_number", "type": "text", "required": True, "label": "PO Number"}
                ]
            },
            "L6": {
                "fields": [
                    {"name": "final_value", "type": "number", "required": True, "label": "Final Value"},
                    {"name": "handover_status", "type": "select", "required": True, "label": "Handover Status"}
                ]
            },
            "L7": {
                "fields": [
                    {"name": "lost_reason", "type": "select", "required": True, "label": "Lost Reason"},
                    {"name": "competitor", "type": "text", "required": False, "label": "Competitor"}
                ]
            },
            "L8": {
                "fields": [
                    {"name": "drop_reason", "type": "select", "required": True, "label": "Drop Reason"}
                ]
            }
        }
        
        schema = stage_schemas.get(stage_id, {"fields": []})
        return APIResponse(success=True, message="Stage schema retrieved successfully", data=schema)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/opportunities/{opportunity_id}/stage-access/{stage_id}", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def check_stage_access(opportunity_id: str, stage_id: str, current_user: User = Depends(get_current_user)):
    """Check if a stage can be accessed based on business rules"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Stage access rules
        if stage_id == "L5":
            # L5 accessible only if at least one quotation is Approved
            approved_quotations = await db.quotations.find({
                "opportunity_id": opportunity_id,
                "is_deleted": False,
                "status": "Approved"
            }).to_list(None)
            
            if not approved_quotations:
                return APIResponse(
                    success=True, 
                    message="L5 stage access denied. At least one quotation must be Approved to access Commercial Negotiations.",
                    data={
                        "stage_id": stage_id,
                        "access_granted": False,
                        "approved_quotations_count": 0,
                        "reason": "No approved quotations found",
                        "guard_message": "Proceed to L5 after a quotation is Approved."
                    }
                )
            else:
                return APIResponse(
                    success=True,
                    message="L5 stage access granted",
                    data={
                        "stage_id": stage_id,
                        "access_granted": True,
                        "approved_quotations_count": len(approved_quotations),
                        "reason": "Access requirements met"
                    }
                )
        
        # Default: stage is accessible
        return APIResponse(
            success=True,
            message="Stage access granted",
            data={
                "stage_id": stage_id,
                "accessible": True,
                "reason": "Access requirements met"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add permission for internal cost visibility
async def check_internal_cost_permission(user: User) -> bool:
    """Check if user can view internal costs (CPC/Overhead fields)"""
    try:
        # Get user's role
        user_doc = await db.users.find_one({"id": user.id, "is_deleted": False})
        if not user_doc:
            return False
        
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        if not role:
            return False
        
        # Check if user has internal cost viewing permissions
        allowed_roles = ["Admin", "Commercial Approver"]
        return role["name"] in allowed_roles
        
    except Exception:
        return False

@api_router.get("/auth/permissions/internal-costs", response_model=APIResponse)
async def check_internal_cost_access(current_user: User = Depends(get_current_user)):
    """Check if current user can view internal cost fields"""
    try:
        # Get user's role
        user_doc = await db.users.find_one({"id": current_user.id, "is_deleted": False})
        user_role = "Unknown"
        can_view_cpc = False
        can_view_overhead = False
        
        if user_doc:
            role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
            if role:
                user_role = role["name"]
                # Check permissions based on role
                if user_role in ["Admin", "Commercial Approver", "Sales Manager"]:
                    can_view_cpc = True
                    can_view_overhead = True
        
        return APIResponse(
            success=True,
            message="Internal cost permission checked",
            data={
                "can_view_cpc": can_view_cpc,
                "can_view_overhead": can_view_overhead,
                "user_role": user_role
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== SERVICE DELIVERY (SD) MODULE APIs =====

# Auto-initiation trigger for L6 opportunities
async def auto_initiate_service_delivery(opportunity_id: str, user_id: str):
    """Auto-initiate Service Delivery Request when opportunity reaches L6 (Won)"""
    try:
        # Check if SDR already exists for this opportunity
        existing_sdr = await db.service_delivery_requests.find_one({
            "opportunity_id": opportunity_id,
            "is_deleted": False
        })
        
        if existing_sdr:
            return {"message": "Service Delivery Request already exists", "sdr_id": existing_sdr["id"]}
        
        # Get opportunity details
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get approved quotation for project value
        approved_quotation = await db.quotations.find_one({
            "opportunity_id": opportunity_id,
            "status": "Approved",
            "is_deleted": False
        })
        
        # Create Service Delivery Request
        sdr = ServiceDeliveryRequest(
            opportunity_id=opportunity_id,
            project_value=approved_quotation.get("grand_total", 0) if approved_quotation else None,
            client_name=opportunity.get("company_name", ""),
            sales_owner_id=opportunity.get("opportunity_owner_id"),
            created_by=user_id
        )
        
        await db.service_delivery_requests.insert_one(sdr.dict())
        
        # Log the auto-initiation
        log_entry = ServiceDeliveryLog(
            sd_request_id=sdr.id,
            opportunity_id=opportunity_id,
            action_type="Creation",
            action_description=f"Auto-initiated SDR for opportunity {opportunity.get('opportunity_title', '')}",
            user_id=user_id,
            user_role="System"
        )
        await db.service_delivery_logs.insert_one(log_entry.dict())
        
        return {"message": "Service Delivery Request created successfully", "sdr_id": sdr.id}
        
    except Exception as e:
        # Log error
        error_log = ServiceDeliveryLog(
            opportunity_id=opportunity_id,
            action_type="Creation",
            action_status="Failed",
            action_description=f"Failed to auto-initiate SDR: {str(e)}",
            user_id=user_id,
            error_message=str(e)
        )
        await db.service_delivery_logs.insert_one(error_log.dict())
        raise HTTPException(status_code=500, detail=f"Failed to create Service Delivery Request: {str(e)}")

# 1. Upcoming Projects APIs
@api_router.get("/service-delivery/upcoming", response_model=APIResponse)
@require_permission("/service-delivery", "view")
async def get_upcoming_projects(current_user: User = Depends(get_current_user)):
    """Get all upcoming projects for review"""
    try:
        # Get upcoming service delivery requests
        sdrs = await db.service_delivery_requests.find({
            "project_status": "Upcoming",
            "is_deleted": False
        }).sort("created_at", -1).to_list(1000)
        
        enriched_sdrs = []
        for sdr in sdrs:
            # Enrich with opportunity data
            opportunity = await db.opportunities.find_one({"id": sdr["opportunity_id"], "is_deleted": False})
            
            # Enrich with sales owner data
            sales_owner = None
            if sdr.get("sales_owner_id"):
                sales_owner = await db.users.find_one({"id": sdr["sales_owner_id"], "is_deleted": False})
            
            # Get approved quotation
            approved_quotation = await db.quotations.find_one({
                "opportunity_id": sdr["opportunity_id"],
                "status": "Approved",
                "is_deleted": False
            })
            
            enriched_sdr = {
                **sdr,
                "opportunity_title": opportunity.get("opportunity_title", "") if opportunity else "",
                "opportunity_value": opportunity.get("estimated_value", 0) if opportunity else 0,
                "client_name": opportunity.get("company_name", "") if opportunity else sdr.get("client_name", ""),
                "sales_owner_name": f"{sales_owner['name']}" if sales_owner else "Unassigned",
                "quotation_id": approved_quotation.get("quotation_number", "") if approved_quotation else "",
                "quotation_total": approved_quotation.get("grand_total", 0) if approved_quotation else 0
            }
            
            # Remove MongoDB _id
            enriched_sdr.pop("_id", None)
            enriched_sdrs.append(enriched_sdr)
        
        return APIResponse(
            success=True,
            message="Upcoming projects retrieved successfully",
            data=enriched_sdrs
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve upcoming projects: {str(e)}")

@api_router.get("/service-delivery/upcoming/{sdr_id}/details", response_model=APIResponse)
@require_permission("/service-delivery", "view")
async def get_project_review_details(sdr_id: str, current_user: User = Depends(get_current_user)):
    """Get complete review details for a service delivery request"""
    try:
        # Get SDR
        sdr = await db.service_delivery_requests.find_one({"id": sdr_id, "is_deleted": False})
        if not sdr:
            raise HTTPException(status_code=404, detail="Service Delivery Request not found")
        
        # Get opportunity data
        opportunity = await db.opportunities.find_one({"id": sdr["opportunity_id"], "is_deleted": False})
        
        # Get lead data (if linked)
        lead_data = None
        if opportunity and opportunity.get("linked_lead_id"):
            lead_data = await db.leads.find_one({"id": opportunity["linked_lead_id"], "is_deleted": False})
        
        # Get approved quotation
        approved_quotation = await db.quotations.find_one({
            "opportunity_id": sdr["opportunity_id"],
            "status": "Approved",
            "is_deleted": False
        })
        
        # Get quotation details (phases, groups, items)
        quotation_details = None
        if approved_quotation:
            phases = await db.quotation_phases.find({
                "quotation_id": approved_quotation["id"],
                "is_deleted": False
            }).to_list(100)
            
            for phase in phases:
                groups = await db.quotation_groups.find({
                    "phase_id": phase["id"],
                    "is_deleted": False
                }).to_list(100)
                
                for group in groups:
                    items = await db.quotation_items.find({
                        "group_id": group["id"],
                        "is_deleted": False
                    }).to_list(100)
                    group["items"] = items
                
                phase["groups"] = groups
            
            quotation_details = {
                **approved_quotation,
                "phases": phases
            }
            quotation_details.pop("_id", None)
        
        # Get sales submission history
        sales_history = await db.service_delivery_logs.find({
            "opportunity_id": sdr["opportunity_id"],
            "action_type": {"$in": ["Creation", "Review", "Approval", "Rejection"]}
        }).sort("timestamp", -1).to_list(100)
        
        # Clean up data
        sdr.pop("_id", None)
        if opportunity:
            opportunity.pop("_id", None)
        if lead_data:
            lead_data.pop("_id", None)
        
        review_data = {
            "sdr": sdr,
            "opportunity": opportunity,
            "lead": lead_data,
            "approved_quotation": quotation_details,
            "sales_history": sales_history
        }
        
        return APIResponse(
            success=True,
            message="Project review details retrieved successfully",
            data=review_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve project details: {str(e)}")

@api_router.post("/service-delivery/upcoming/{sdr_id}/convert", response_model=APIResponse)
@require_permission("/service-delivery", "edit")
async def convert_to_project(sdr_id: str, current_user: User = Depends(get_current_user)):
    """Convert Upcoming Project to Active Project"""
    try:
        # Get SDR
        sdr = await db.service_delivery_requests.find_one({"id": sdr_id, "is_deleted": False})
        if not sdr:
            raise HTTPException(status_code=404, detail="Service Delivery Request not found")
        
        if sdr["project_status"] != "Upcoming":
            raise HTTPException(status_code=400, detail="Only Upcoming projects can be converted")
        
        # Update SDR status
        update_data = {
            "project_status": "Project",
            "approval_status": "Approved",
            "delivery_status": "In-Progress",
            "modified_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.service_delivery_requests.update_one(
            {"id": sdr_id},
            {"$set": update_data}
        )
        
        # Create approval record
        approval = ServiceDeliveryApproval(
            sd_request_id=sdr_id,
            approver_id=current_user.id,
            approver_role="Delivery Manager",  # This could be dynamic based on user role
            approval_status="Approved",
            remarks="Converted to active project",
            approved_at=datetime.now(timezone.utc),
            created_by=current_user.id
        )
        await db.service_delivery_approvals.insert_one(approval.dict())
        
        # Log the conversion
        log_entry = ServiceDeliveryLog(
            sd_request_id=sdr_id,
            opportunity_id=sdr["opportunity_id"],
            action_type="Approval",
            action_description="Converted Upcoming Project to Active Project",
            user_id=current_user.id,
            user_role="Delivery Manager"
        )
        await db.service_delivery_logs.insert_one(log_entry.dict())
        
        return APIResponse(
            success=True,
            message="Project converted successfully. Delivery tracking has begun."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to convert project: {str(e)}")

@api_router.post("/service-delivery/upcoming/{sdr_id}/reject", response_model=APIResponse)
@require_permission("/service-delivery", "edit")
async def reject_opportunity(sdr_id: str, rejection_data: dict, current_user: User = Depends(get_current_user)):
    """Reject Opportunity - closes SD and marks for review"""
    try:
        # Get SDR
        sdr = await db.service_delivery_requests.find_one({"id": sdr_id, "is_deleted": False})
        if not sdr:
            raise HTTPException(status_code=404, detail="Service Delivery Request not found")
        
        if sdr["project_status"] != "Upcoming":
            raise HTTPException(status_code=400, detail="Only Upcoming projects can be rejected")
        
        rejection_reason = rejection_data.get("remarks", "No reason provided")
        
        # Update SDR status
        update_data = {
            "project_status": "Rejected",
            "approval_status": "Rejected",
            "rejection_reason": rejection_reason,
            "modified_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.service_delivery_requests.update_one(
            {"id": sdr_id},
            {"$set": update_data}
        )
        
        # Create rejection record
        approval = ServiceDeliveryApproval(
            sd_request_id=sdr_id,
            approver_id=current_user.id,
            approver_role="Delivery Manager",
            approval_status="Rejected",
            remarks=rejection_reason,
            rejection_reason=rejection_reason,
            approved_at=datetime.now(timezone.utc),
            created_by=current_user.id
        )
        await db.service_delivery_approvals.insert_one(approval.dict())
        
        # Log the rejection
        log_entry = ServiceDeliveryLog(
            sd_request_id=sdr_id,
            opportunity_id=sdr["opportunity_id"],
            action_type="Rejection",
            action_description=f"Opportunity rejected: {rejection_reason}",
            user_id=current_user.id,
            user_role="Delivery Manager"
        )
        await db.service_delivery_logs.insert_one(log_entry.dict())
        
        return APIResponse(
            success=True,
            message="Opportunity rejected successfully. SD closed for delivery."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject opportunity: {str(e)}")

# 2. Active Projects APIs
@api_router.get("/service-delivery/projects", response_model=APIResponse)
@require_permission("/service-delivery", "view")
async def get_active_projects(current_user: User = Depends(get_current_user)):
    """Get all active delivery projects"""
    try:
        projects = await db.service_delivery_requests.find({
            "project_status": "Project",
            "is_deleted": False
        }).sort("created_at", -1).to_list(1000)
        
        enriched_projects = []
        for project in projects:
            # Enrich with opportunity data
            opportunity = await db.opportunities.find_one({"id": project["opportunity_id"], "is_deleted": False})
            
            # Enrich with delivery owner
            delivery_owner = None
            if project.get("delivery_owner_id"):
                delivery_owner = await db.users.find_one({"id": project["delivery_owner_id"], "is_deleted": False})
            
            enriched_project = {
                **project,
                "opportunity_title": opportunity.get("opportunity_title", "") if opportunity else "",
                "delivery_owner_name": delivery_owner.get("name", "Unassigned") if delivery_owner else "Unassigned"
            }
            
            enriched_project.pop("_id", None)
            enriched_projects.append(enriched_project)
        
        return APIResponse(
            success=True,
            message="Active projects retrieved successfully",
            data=enriched_projects
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve active projects: {str(e)}")

# 3. Completed Projects APIs
@api_router.get("/service-delivery/completed", response_model=APIResponse)
@require_permission("/service-delivery", "view")
async def get_completed_projects(current_user: User = Depends(get_current_user)):
    """Get all completed projects"""
    try:
        completed_projects = await db.service_delivery_requests.find({
            "project_status": "Completed",
            "is_deleted": False
        }).sort("updated_at", -1).to_list(1000)
        
        enriched_projects = []
        for project in completed_projects:
            # Enrich with opportunity data
            opportunity = await db.opportunities.find_one({"id": project["opportunity_id"], "is_deleted": False})
            
            enriched_project = {
                **project,
                "opportunity_title": opportunity.get("opportunity_title", "") if opportunity else ""
            }
            
            enriched_project.pop("_id", None)
            enriched_projects.append(enriched_project)
        
        return APIResponse(
            success=True,
            message="Completed projects retrieved successfully",
            data=enriched_projects
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve completed projects: {str(e)}")

# 4. Service Delivery Logs APIs
@api_router.get("/service-delivery/logs", response_model=APIResponse)
@require_permission("/service-delivery", "view")
async def get_delivery_logs(
    current_user: User = Depends(get_current_user),
    opportunity_id: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 100
):
    """Get delivery logs with optional filters"""
    try:
        # Build query
        query = {"is_active": True}
        if opportunity_id:
            query["opportunity_id"] = opportunity_id
        if action_type:
            query["action_type"] = action_type
        
        logs = await db.service_delivery_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # Enrich with user names
        enriched_logs = []
        for log in logs:
            user = await db.users.find_one({"id": log["user_id"], "is_deleted": False})
            
            enriched_log = {
                **log,
                "user_name": user.get("name", "Unknown") if user else "Unknown"
            }
            
            enriched_log.pop("_id", None)
            enriched_logs.append(enriched_log)
        
        return APIResponse(
            success=True,
            message="Delivery logs retrieved successfully",
            data=enriched_logs
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve delivery logs: {str(e)}")

# 5. Reports & Analytics APIs
@api_router.get("/service-delivery/analytics", response_model=APIResponse)
@require_permission("/service-delivery", "view")
async def get_delivery_analytics(current_user: User = Depends(get_current_user)):
    """Get delivery analytics and metrics"""
    try:
        # Count by status
        upcoming_count = await db.service_delivery_requests.count_documents({
            "project_status": "Upcoming",
            "is_deleted": False
        })
        
        projects_count = await db.service_delivery_requests.count_documents({
            "project_status": "Project",
            "is_deleted": False
        })
        
        completed_count = await db.service_delivery_requests.count_documents({
            "project_status": "Completed",
            "is_deleted": False
        })
        
        rejected_count = await db.service_delivery_requests.count_documents({
            "project_status": "Rejected",
            "is_deleted": False
        })
        
        # Get delivery status distribution
        in_progress_count = await db.service_delivery_requests.count_documents({
            "delivery_status": "In-Progress",
            "is_deleted": False
        })
        
        partial_count = await db.service_delivery_requests.count_documents({
            "delivery_status": "Partial",
            "is_deleted": False
        })
        
        # Calculate average delivery progress for active projects
        active_projects = await db.service_delivery_requests.find({
            "project_status": "Project",
            "is_deleted": False
        }).to_list(1000)
        
        avg_progress = 0
        if active_projects:
            total_progress = sum(project.get("delivery_progress", 0) for project in active_projects)
            avg_progress = total_progress / len(active_projects)
        
        analytics_data = {
            "status_distribution": {
                "upcoming": upcoming_count,
                "projects": projects_count,
                "completed": completed_count,
                "rejected": rejected_count
            },
            "delivery_distribution": {
                "in_progress": in_progress_count,
                "partial": partial_count,
                "completed": completed_count
            },
            "metrics": {
                "total_projects": upcoming_count + projects_count + completed_count + rejected_count,
                "active_projects": projects_count,
                "average_progress": round(avg_progress, 2),
                "completion_rate": round((completed_count / max(1, completed_count + projects_count)) * 100, 2)
            }
        }
        
        return APIResponse(
            success=True,
            message="Delivery analytics retrieved successfully",
            data=analytics_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve delivery analytics: {str(e)}")

# Auto-trigger integration with opportunity status changes
@api_router.post("/service-delivery/auto-initiate/{opportunity_id}", response_model=APIResponse)
async def trigger_auto_initiation(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Manual trigger for auto-initiation (for testing/admin purposes)"""
    try:
        result = await auto_initiate_service_delivery(opportunity_id, current_user.id)
        return APIResponse(success=True, message=result["message"], data={"sdr_id": result["sdr_id"]})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END SERVICE DELIVERY MODULE APIs =====

# ===== COMPANY MANAGEMENT MODULE - ENHANCED MASTER DATA APIs =====

# Business Type Master
class BusinessTypeMaster(BaseModel):
    id: str
    business_type_name: str
    description: Optional[str] = None
    validation_rules: Optional[str] = None  # JSON string for rules
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

# Industry Master
class IndustryMaster(BaseModel):
    id: str
    industry_name: str
    industry_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

# Sub-Industry Master
class SubIndustryMaster(BaseModel):
    id: str
    sub_industry_name: str
    industry_id: str  # Foreign key to Industry
    sub_industry_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

# Country Master
class CountryMaster(BaseModel):
    id: str
    country_name: str
    country_code: Optional[str] = None
    currency_code: Optional[str] = None
    status: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# State Master
class StateMaster(BaseModel):
    id: str
    state_name: str
    country_id: str  # Foreign key to Country
    state_code: Optional[str] = None
    status: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# City Master
class CityMaster(BaseModel):
    id: str
    city_name: str
    state_id: str  # Foreign key to State
    city_code: Optional[str] = None
    status: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Enhanced Company Model
class EnhancedCompany(BaseModel):
    id: str
    company_name: str
    company_type: str  # Private, Public, LLP, Govt
    account_type: str  # Customer, Partner, Vendor, Prospect
    business_type: str  # Domestic, International
    industry_id: str
    sub_industry_id: Optional[str] = None
    region: str  # APAC, EMEA, NA, LATAM
    is_child_company: bool = False
    parent_company_id: Optional[str] = None
    
    # Address Information
    address: str
    country_id: str
    state_id: str
    city_id: str
    status: bool = True
    
    # Document Information
    pan_number: Optional[str] = None
    gst_number: Optional[str] = None
    vat_number: Optional[str] = None
    website: Optional[str] = None
    billing_record_id: str
    
    # Financial Information
    employee_count: int = 0
    annual_revenue: Optional[float] = None
    currency_id: Optional[str] = None
    gc_approval_flag: bool = False
    
    # Contact Information
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    remarks: Optional[str] = None
    
    # Audit fields
    is_active: bool = True
    is_deleted: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

# ===== MASTER DATA CRUD APIs =====

# Business Type Master APIs
@api_router.get("/master/business-types", response_model=APIResponse)
async def get_business_types(current_user: User = Depends(get_current_user)):
    """Get all business types"""
    try:
        business_types = await db.business_types.find({"is_active": True}).to_list(None)
        return APIResponse(success=True, message="Business types retrieved successfully", data=business_types)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/master/business-types", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_business_type(business_type_data: dict, current_user: User = Depends(get_current_user)):
    """Create new business type (Admin only)"""
    try:
        if current_user.role_name.lower() != 'admin':
            raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
        
        business_type = {
            "id": str(uuid.uuid4()),
            "business_type_name": business_type_data["business_type_name"],
            "description": business_type_data.get("description"),
            "validation_rules": business_type_data.get("validation_rules"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "created_by": current_user.id
        }
        
        await db.business_types.insert_one(business_type)
        return APIResponse(success=True, message="Business type created successfully", data=business_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Industry Master APIs
@api_router.get("/master/industries", response_model=APIResponse)
async def get_industries(current_user: User = Depends(get_current_user)):
    """Get all industries"""
    try:
        industries = await db.industries.find({"is_active": True}).to_list(None)
        return APIResponse(success=True, message="Industries retrieved successfully", data=industries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/master/industries/{industry_id}/sub-industries", response_model=APIResponse)
async def get_sub_industries_by_industry(industry_id: str, current_user: User = Depends(get_current_user)):
    """Get sub-industries for specific industry"""
    try:
        sub_industries = await db.sub_industries.find({"industry_id": industry_id, "is_active": True}).to_list(None)
        return APIResponse(success=True, message="Sub-industries retrieved successfully", data=sub_industries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Country Master APIs
@api_router.get("/master/countries", response_model=APIResponse)
async def get_countries(current_user: User = Depends(get_current_user)):
    """Get all countries"""
    try:
        countries = await db.countries.find({"status": True}).to_list(None)
        return APIResponse(success=True, message="Countries retrieved successfully", data=countries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/master/countries/{country_id}/states", response_model=APIResponse)
async def get_states_by_country(country_id: str, current_user: User = Depends(get_current_user)):
    """Get states for specific country"""
    try:
        states = await db.states.find({"country_id": country_id, "status": True}).to_list(None)
        return APIResponse(success=True, message="States retrieved successfully", data=states)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/master/states/{state_id}/cities", response_model=APIResponse)
async def get_cities_by_state(state_id: str, current_user: User = Depends(get_current_user)):
    """Get cities for specific state"""
    try:
        cities = await db.cities.find({"state_id": state_id, "status": True}).to_list(None)
        return APIResponse(success=True, message="Cities retrieved successfully", data=cities)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Enhanced Company APIs
@api_router.post("/companies/enhanced", response_model=APIResponse)
@require_permission("/companies", "create")
async def create_enhanced_company(company_data: dict, current_user: User = Depends(get_current_user)):
    """Create enhanced company with validation rules"""
    try:
        if current_user.role_name.lower() != 'admin':
            raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
        
        # Validate business type requirements
        business_type = company_data.get("business_type")
        if business_type == "Domestic":
            if not company_data.get("pan_number") or not company_data.get("gst_number"):
                raise HTTPException(status_code=400, detail="PAN and GST numbers are required for Domestic companies")
        elif business_type == "International":
            if not company_data.get("vat_number"):
                raise HTTPException(status_code=400, detail="VAT number is required for International companies")
        
        # Validate parent company requirement
        if company_data.get("is_child_company") and not company_data.get("parent_company_id"):
            raise HTTPException(status_code=400, detail="Parent company is required for child companies")
        
        # Validate currency requirement
        if company_data.get("annual_revenue") and not company_data.get("currency_id"):
            raise HTTPException(status_code=400, detail="Currency is required when annual revenue is provided")
        
        # Auto-calculate GC Approval Flag
        gc_approval_flag = False
        industry_id = company_data.get("industry_id")
        annual_revenue = company_data.get("annual_revenue", 0)
        
        # Get industry name for GC approval check
        if industry_id:
            industry = await db.industries.find_one({"id": industry_id})
            if industry and industry.get("industry_name") in ["BFSI", "Healthcare"]:
                gc_approval_flag = True
        
        # Check revenue threshold ($1M = approximately 83,00,000 INR)
        if annual_revenue and annual_revenue > 8300000:  # $1M threshold
            gc_approval_flag = True
        
        # Check unique constraints
        existing_company = await db.companies.find_one({
            "company_name": company_data["company_name"],
            "is_deleted": False
        })
        if existing_company:
            raise HTTPException(status_code=400, detail="Company name already exists")
        
        if company_data.get("billing_record_id"):
            existing_billing = await db.companies.find_one({
                "billing_record_id": company_data["billing_record_id"],
                "is_deleted": False
            })
            if existing_billing:
                raise HTTPException(status_code=400, detail="Billing Record ID already exists")
        
        # Create company
        company = {
            "id": str(uuid.uuid4()),
            "company_name": company_data["company_name"],
            "company_type": company_data["company_type"],
            "account_type": company_data["account_type"],
            "business_type": company_data["business_type"],
            "industry_id": company_data["industry_id"],
            "sub_industry_id": company_data.get("sub_industry_id"),
            "region": company_data["region"],
            "is_child_company": company_data.get("is_child_company", False),
            "parent_company_id": company_data.get("parent_company_id"),
            
            # Address
            "address": company_data["address"],
            "country_id": company_data["country_id"],
            "state_id": company_data["state_id"],
            "city_id": company_data["city_id"],
            "status": company_data.get("status", True),
            
            # Documents
            "pan_number": company_data.get("pan_number"),
            "gst_number": company_data.get("gst_number"),
            "vat_number": company_data.get("vat_number"),
            "website": company_data.get("website"),
            "billing_record_id": company_data["billing_record_id"],
            
            # Financial
            "employee_count": company_data.get("employee_count", 0),
            "annual_revenue": company_data.get("annual_revenue"),
            "currency_id": company_data.get("currency_id"),
            "gc_approval_flag": gc_approval_flag,
            
            # Contact
            "contact_person": company_data.get("contact_person"),
            "email": company_data.get("email"),
            "phone": company_data.get("phone"),
            "remarks": company_data.get("remarks"),
            
            # Audit
            "is_active": True,
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc),
            "created_by": current_user.id
        }
        
        await db.companies.insert_one(company)
        
        # Create audit log
        audit_log = {
            "id": str(uuid.uuid4()),
            "entity_type": "company",
            "entity_id": company["id"],
            "action": "create",
            "user_id": current_user.id,
            "timestamp": datetime.now(timezone.utc),
            "details": {"company_name": company["company_name"], "action": "Company created"}
        }
        await db.audit_logs.insert_one(audit_log)
        
        return APIResponse(success=True, message="Company created successfully", data=company)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/companies/enhanced", response_model=APIResponse)
@require_permission("/companies", "view")
async def get_enhanced_companies(current_user: User = Depends(get_current_user)):
    """Get all enhanced companies with enriched data"""
    try:
        # Get companies with related data
        companies_cursor = db.companies.find({"is_deleted": False})
        companies = await companies_cursor.to_list(None)
        
        # Enrich with related data
        for company in companies:
            # Get industry name
            if company.get("industry_id"):
                industry = await db.industries.find_one({"id": company["industry_id"]})
                company["industry_name"] = industry.get("industry_name") if industry else None
            
            # Get sub-industry name
            if company.get("sub_industry_id"):
                sub_industry = await db.sub_industries.find_one({"id": company["sub_industry_id"]})
                company["sub_industry_name"] = sub_industry.get("sub_industry_name") if sub_industry else None
            
            # Get country name
            if company.get("country_id"):
                country = await db.countries.find_one({"id": company["country_id"]})
                company["country_name"] = country.get("country_name") if country else None
            
            # Get state name
            if company.get("state_id"):
                state = await db.states.find_one({"id": company["state_id"]})
                company["state_name"] = state.get("state_name") if state else None
            
            # Get city name
            if company.get("city_id"):
                city = await db.cities.find_one({"id": company["city_id"]})
                company["city_name"] = city.get("city_name") if city else None
            
            # Get parent company name
            if company.get("parent_company_id"):
                parent = await db.companies.find_one({"id": company["parent_company_id"]})
                company["parent_company_name"] = parent.get("company_name") if parent else None
            
            # Get currency name
            if company.get("currency_id"):
                currency = await db.currencies.find_one({"id": company["currency_id"]})
                company["currency_name"] = currency.get("currency_name") if currency else None
        
        return APIResponse(success=True, message="Enhanced companies retrieved successfully", data=companies)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Company validation endpoint
@api_router.post("/companies/validate", response_model=APIResponse)
async def validate_company_data(validation_data: dict, current_user: User = Depends(get_current_user)):
    """Validate company data before submission"""
    try:
        errors = []
        
        # Business type validation
        business_type = validation_data.get("business_type")
        if business_type == "Domestic":
            if not validation_data.get("pan_number"):
                errors.append("PAN number is required for Domestic companies")
            if not validation_data.get("gst_number"):
                errors.append("GST number is required for Domestic companies")
        elif business_type == "International":
            if not validation_data.get("vat_number"):
                errors.append("VAT number is required for International companies")
        
        # Parent company validation
        if validation_data.get("is_child_company") and not validation_data.get("parent_company_id"):
            errors.append("Parent company is required for child companies")
        
        # Currency validation
        if validation_data.get("annual_revenue") and not validation_data.get("currency_id"):
            errors.append("Currency is required when annual revenue is provided")
        
        # Unique validation
        if validation_data.get("company_name"):
            existing = await db.companies.find_one({
                "company_name": validation_data["company_name"],
                "is_deleted": False
            })
            if existing and existing.get("id") != validation_data.get("id"):
                errors.append("Company name already exists")
        
        if validation_data.get("billing_record_id"):
            existing = await db.companies.find_one({
                "billing_record_id": validation_data["billing_record_id"],
                "is_deleted": False
            })
            if existing and existing.get("id") != validation_data.get("id"):
                errors.append("Billing Record ID already exists")
        
        return APIResponse(
            success=len(errors) == 0,
            message="Validation completed" if len(errors) == 0 else "Validation failed",
            data={"errors": errors}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PROFITABILITY VISUALIZATION MODULE APIs =====

# Profitability calculation model
class ProfitabilityItem(BaseModel):
    sr_no: int
    product_name: str
    sku_code: str
    qty: int
    unit: str
    cost_per_unit: float
    total_cost: float
    price_list_per_unit: float
    selling_rate_per_unit: float
    discount_percentage: float = 0.0
    total_selling_price: float
    phase: Optional[str] = None

class ProfitabilitySummary(BaseModel):
    total_one_time_cost: float
    total_recurring_purchase_cost: float
    external_purchase_cost: float
    total_tenure: int
    total_project_cost: float
    total_selling_price: float
    total_project_profit: float
    profit_percentage: float
    currency: str

class ProfitabilityAnalysis(BaseModel):
    items: List[ProfitabilityItem]
    summary: ProfitabilitySummary
    phase_totals: Dict[str, float]
    grand_total: float

# Get profitability analysis for opportunity
@api_router.get("/opportunities/{opportunity_id}/profitability", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_profitability(
    opportunity_id: str, 
    currency: str = "INR",
    current_user: User = Depends(get_current_user)
):
    """Get profitability analysis for opportunity"""
    try:
        # Check user role (Sales Executive or Manager)
        user_doc = await db.users.find_one({"id": current_user.id, "is_deleted": False})
        if not user_doc:
            raise HTTPException(status_code=403, detail="User not found")
        
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        user_role = role["name"].lower() if role else "unknown"
        
        if user_role not in ['sales executive', 'manager', 'admin']:
            raise HTTPException(status_code=403, detail="Access denied. Sales Executive/Manager role required.")
        
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Check if opportunity is in L4 stage or beyond
        current_stage = opportunity.get("current_stage_name", "L1")
        if current_stage not in ["L4", "L5", "L6", "L7", "L8"]:
            return APIResponse(success=False, message="Profitability analysis available from L4 Technical Qualification stage onwards", data=None)
        
        # Get quotation data from stage form data
        stage_form_data = opportunity.get("stage_form_data", {})
        if not stage_form_data:
            raise HTTPException(status_code=400, detail="Quotation data incomplete for profitability analysis.")
        
        # Verify currency exists
        currency_data = await db.master_currencies.find_one({"currency_code": currency})
        if not currency_data:
            raise HTTPException(status_code=400, detail="Invalid currency.")
        
        # Get exchange rate for currency conversion
        exchange_rate = 1.0  # Default for base currency
        if currency != "INR":
            rate_data = await db.exchange_rates.find_one({"currency_code": currency})
            if rate_data:
                exchange_rate = rate_data.get("rate", 1.0)
        
        # Mock profitability calculation (in real system, this would use actual product/cost data)
        profitability_items = []
        phase_totals = {}
        
        # Sample profitability data based on opportunity
        sample_items = [
            {
                "sr_no": 1,
                "product_name": "Server Hardware",
                "sku_code": "SRV-001",
                "qty": 2,
                "unit": "Pcs",
                "cost_per_unit": 50000 * exchange_rate,
                "total_cost": 100000 * exchange_rate,
                "price_list_per_unit": 75000 * exchange_rate,
                "selling_rate_per_unit": 70000 * exchange_rate,
                "discount_percentage": 6.67,
                "total_selling_price": 140000 * exchange_rate,
                "phase": "Hardware"
            },
            {
                "sr_no": 2,
                "product_name": "Software License",
                "sku_code": "SW-001",
                "qty": 10,
                "unit": "License",
                "cost_per_unit": 8000 * exchange_rate,
                "total_cost": 80000 * exchange_rate,
                "price_list_per_unit": 12000 * exchange_rate,
                "selling_rate_per_unit": 11000 * exchange_rate,
                "discount_percentage": 8.33,
                "total_selling_price": 110000 * exchange_rate,
                "phase": "Software"
            },
            {
                "sr_no": 3,
                "product_name": "Implementation Services",
                "sku_code": "SVC-001",
                "qty": 1,
                "unit": "Project",
                "cost_per_unit": 150000 * exchange_rate,
                "total_cost": 150000 * exchange_rate,
                "price_list_per_unit": 200000 * exchange_rate,
                "selling_rate_per_unit": 190000 * exchange_rate,
                "discount_percentage": 5.0,
                "total_selling_price": 190000 * exchange_rate,
                "phase": "Services"
            },
            {
                "sr_no": 4,
                "product_name": "Annual Maintenance",
                "sku_code": "AMC-001",
                "qty": 3,
                "unit": "Years",
                "cost_per_unit": 25000 * exchange_rate,
                "total_cost": 75000 * exchange_rate,
                "price_list_per_unit": 40000 * exchange_rate,
                "selling_rate_per_unit": 38000 * exchange_rate,
                "discount_percentage": 5.0,
                "total_selling_price": 114000 * exchange_rate,
                "phase": "Support"
            }
        ]
        
        # Convert to ProfitabilityItem objects
        for item_data in sample_items:
            item = ProfitabilityItem(**item_data)
            profitability_items.append(item)
            
            # Calculate phase totals
            phase = item.phase
            if phase not in phase_totals:
                phase_totals[phase] = 0
            phase_totals[phase] += item.total_selling_price
        
        # Calculate summary
        total_project_cost = sum(item.total_cost for item in profitability_items)
        total_selling_price = sum(item.total_selling_price for item in profitability_items)
        total_project_profit = total_selling_price - total_project_cost
        profit_percentage = (total_project_profit / total_selling_price * 100) if total_selling_price > 0 else 0
        
        summary = ProfitabilitySummary(
            total_one_time_cost=total_project_cost * 0.7,  # 70% one-time
            total_recurring_purchase_cost=total_project_cost * 0.3,  # 30% recurring
            external_purchase_cost=total_project_cost * 0.2,  # 20% external
            total_tenure=3,  # 3 years
            total_project_cost=total_project_cost,
            total_selling_price=total_selling_price,
            total_project_profit=total_project_profit,
            profit_percentage=round(profit_percentage, 2),
            currency=currency
        )
        
        analysis = ProfitabilityAnalysis(
            items=profitability_items,
            summary=summary,
            phase_totals=phase_totals,
            grand_total=total_selling_price
        )
        
        return APIResponse(success=True, message="Profitability analysis generated successfully", data=analysis.dict())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate profitability data. Try again.")

# What-if analysis for profitability
@api_router.post("/opportunities/{opportunity_id}/profitability/what-if", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def calculate_what_if_analysis(
    opportunity_id: str, 
    what_if_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Calculate what-if analysis for profitability with hypothetical discount"""
    try:
        # Check user role
        user_doc = await db.users.find_one({"id": current_user.id, "is_deleted": False})
        if not user_doc:
            raise HTTPException(status_code=403, detail="User not found")
        
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        user_role = role["name"].lower() if role else "unknown"
        
        if user_role not in ['sales executive', 'manager', 'admin']:
            raise HTTPException(status_code=403, detail="Access denied. Sales Executive/Manager role required.")
        
        # Get original profitability data
        original_response = await get_opportunity_profitability(
            opportunity_id, 
            what_if_data.get("currency", "INR"), 
            current_user
        )
        
        if not original_response.success:
            return original_response
        
        original_data = original_response.data
        hypothetical_discount = what_if_data.get("hypothetical_discount", 0)
        
        # Apply hypothetical discount to all items
        modified_items = []
        for item in original_data["items"]:
            modified_item = item.copy()
            # Apply additional discount
            new_discount = item["discount_percentage"] + hypothetical_discount
            new_selling_rate = item["price_list_per_unit"] * (1 - new_discount / 100)
            modified_item["discount_percentage"] = new_discount
            modified_item["selling_rate_per_unit"] = new_selling_rate
            modified_item["total_selling_price"] = new_selling_rate * item["qty"]
            modified_items.append(modified_item)
        
        # Recalculate summary
        total_project_cost = original_data["summary"]["total_project_cost"]
        new_total_selling_price = sum(item["total_selling_price"] for item in modified_items)
        new_total_profit = new_total_selling_price - total_project_cost
        new_profit_percentage = (new_total_profit / new_total_selling_price * 100) if new_total_selling_price > 0 else 0
        
        modified_summary = original_data["summary"].copy()
        modified_summary["total_selling_price"] = new_total_selling_price
        modified_summary["total_project_profit"] = new_total_profit
        modified_summary["profit_percentage"] = round(new_profit_percentage, 2)
        
        # Recalculate phase totals
        new_phase_totals = {}
        for item in modified_items:
            phase = item["phase"]
            if phase not in new_phase_totals:
                new_phase_totals[phase] = 0
            new_phase_totals[phase] += item["total_selling_price"]
        
        what_if_analysis = {
            "items": modified_items,
            "summary": modified_summary,
            "phase_totals": new_phase_totals,
            "grand_total": new_total_selling_price,
            "hypothetical_discount_applied": hypothetical_discount
        }
        
        return APIResponse(success=True, message="What-if analysis calculated successfully", data=what_if_analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to calculate what-if analysis. Try again.")

# Export PnL template
@api_router.get("/opportunities/{opportunity_id}/profitability/export", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def export_pnl_template(
    opportunity_id: str,
    currency: str = "INR",
    current_user: User = Depends(get_current_user)
):
    """Export PnL template in Excel format"""
    try:
        # Check user role
        user_doc = await db.users.find_one({"id": current_user.id, "is_deleted": False})
        if not user_doc:
            raise HTTPException(status_code=403, detail="User not found")
        
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        user_role = role["name"].lower() if role else "unknown"
        
        if user_role not in ['sales executive', 'manager', 'admin']:
            raise HTTPException(status_code=403, detail="Access denied. Sales Executive/Manager role required.")
        
        # Get profitability data
        profitability_response = await get_opportunity_profitability(opportunity_id, currency, current_user)
        
        if not profitability_response.success:
            return profitability_response
        
        profitability_data = profitability_response.data
        
        # Get opportunity details
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # In a real implementation, this would generate an actual Excel file
        # For now, we'll return export metadata
        export_data = {
            "opportunity_id": opportunity.get("opportunity_id"),
            "opportunity_title": opportunity.get("opportunity_title"),
            "company_name": opportunity.get("company_name", ""),
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
            "currency": currency,
            "filename": f"PnL_Analysis_{opportunity.get('opportunity_id')}_{currency}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
            "profitability_data": profitability_data,
            "export_url": f"/api/files/pnl-export/{opportunity_id}_{currency}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        }
        
        return APIResponse(success=True, message="PnL exported successfully", data=export_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to export PnL template. Try again.")

# Get historical profit trends (mock data)
@api_router.get("/opportunities/{opportunity_id}/profitability/trends", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_profit_trends(
    opportunity_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get historical profit trends for opportunity"""
    try:
        # Check user role
        user_doc = await db.users.find_one({"id": current_user.id, "is_deleted": False})
        if not user_doc:
            raise HTTPException(status_code=403, detail="User not found")
        
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        user_role = role["name"].lower() if role else "unknown"
        
        if user_role not in ['sales executive', 'manager', 'admin']:
            raise HTTPException(status_code=403, detail="Access denied. Sales Executive/Manager role required.")
        
        # Mock historical trends data
        trends_data = {
            "labels": ["Initial Quote", "Revision 1", "Revision 2", "Final Quote"],
            "profit_values": [275379.6, 250000, 300000, 275379.6],
            "profit_percentages": [21.5, 18.2, 23.1, 21.5],
            "dates": [
                "2024-01-10T10:00:00Z",
                "2024-01-15T14:30:00Z", 
                "2024-01-20T09:15:00Z",
                "2024-01-25T16:45:00Z"
            ]
        }
        
        return APIResponse(success=True, message="Profit trends retrieved successfully", data=trends_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to retrieve profit trends. Try again.")

# Include the router in the main app
# ===== QUOTATION MANAGEMENT SYSTEM (QMS) ENDPOINTS =====

# 1. Quotations CRUD
@api_router.get("/quotations", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_quotations(current_user: User = Depends(get_current_user)):
    """Get all quotations"""
    try:
        quotations = await db.quotations.find({"is_deleted": False}).sort("created_at", -1).to_list(1000)
        
        # Remove MongoDB _id fields
        for quotation in quotations:
            quotation.pop("_id", None)
        
        return APIResponse(success=True, message="Quotations retrieved successfully", data=quotations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/quotations/{quotation_id}", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_quotation(quotation_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific quotation with all related data"""
    try:
        # Get quotation
        quotation = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        # Get phases
        phases = await db.quotation_phases.find({"quotation_id": quotation_id, "is_deleted": False}).sort("phase_order", 1).to_list(100)
        
        # Get groups for each phase
        for phase in phases:
            groups = await db.quotation_groups.find({"phase_id": phase["id"], "is_deleted": False}).sort("group_order", 1).to_list(100)
            
            # Get items for each group
            for group in groups:
                items = await db.quotation_items.find({"group_id": group["id"], "is_deleted": False}).sort("item_order", 1).to_list(1000)
                
                # Get yearly allocations for each item
                for item in items:
                    yearly_data = await db.quotation_item_yearly.find({"item_id": item["id"]}).sort("year_no", 1).to_list(10)
                    item["yearly_allocations"] = yearly_data
                    
                    # Clean MongoDB _id fields
                    for yearly in yearly_data:
                        yearly.pop("_id", None)
                    item.pop("_id", None)
                
                group["items"] = items
                group.pop("_id", None)
            
            phase["groups"] = groups
            phase.pop("_id", None)
        
        quotation["phases"] = phases
        quotation.pop("_id", None)
        
        return APIResponse(success=True, message="Quotation retrieved successfully", data=quotation)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/opportunities/{opportunity_id}/quotations", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_opportunity_quotations(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Get all quotations for a specific opportunity"""
    try:
        # Verify opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Get quotations for this opportunity
        quotations = await db.quotations.find({
            "opportunity_id": opportunity_id, 
            "is_deleted": False
        }).sort("created_at", -1).to_list(1000)
        
        # Calculate totals for each quotation
        for quotation in quotations:
            # Calculate totals from phases
            phases = await db.quotation_phases.find({
                "quotation_id": quotation["id"], 
                "is_deleted": False
            }).to_list(100)
            
            total_otp = sum(phase.get("phase_total_otp", 0) for phase in phases)
            total_recurring = sum(phase.get("phase_total_year1", 0) for phase in phases)
            total_tenure_recurring = sum(
                phase.get("phase_total_year1", 0) + phase.get("phase_total_year2", 0) + 
                phase.get("phase_total_year3", 0) + phase.get("phase_total_year4", 0) +
                phase.get("phase_total_year5", 0) + phase.get("phase_total_year6", 0) +
                phase.get("phase_total_year7", 0) + phase.get("phase_total_year8", 0) +
                phase.get("phase_total_year9", 0) + phase.get("phase_total_year10", 0)
                for phase in phases
            )
            grand_total = total_otp + total_tenure_recurring
            
            # Add calculated totals to quotation
            quotation["calculated_otp"] = total_otp
            quotation["calculated_recurring"] = total_recurring
            quotation["calculated_tenure_recurring"] = total_tenure_recurring
            quotation["calculated_grand_total"] = grand_total
            
            # Remove MongoDB _id field
            quotation.pop("_id", None)
        
        return APIResponse(
            success=True, 
            message="Opportunity quotations retrieved successfully", 
            data=quotations
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/quotations", response_model=APIResponse)
@require_permission("/opportunities", "create")
async def create_quotation(quotation_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new quotation"""
    try:
        # Generate quotation number
        count = await db.quotations.count_documents({"is_deleted": False})
        quotation_number = f"QUO-{datetime.now().strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"
        
        # Create quotation
        quotation_data["quotation_number"] = quotation_number
        quotation_data["created_by"] = current_user.id
        quotation = Quotation(**quotation_data)
        
        result = await db.quotations.insert_one(quotation.dict())
        
        # Log audit trail
        audit_log = QuotationAuditLog(
            quotation_id=quotation.id,
            table_name="quotations",
            record_id=quotation.id,
            action="create",
            user_id=current_user.id,
            user_role="user"
        )
        await db.quotation_audit_log.insert_one(audit_log.dict())
        
        return APIResponse(success=True, message="Quotation created successfully", data={
            "quotation_id": quotation.id,
            "id": quotation.id,
            "quotation_number": quotation_number,
            "status": quotation.status
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/quotations/{quotation_id}", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def update_quotation(quotation_id: str, quotation_data: dict, current_user: User = Depends(get_current_user)):
    """Update a quotation - only allowed for Draft/Unapproved status"""
    try:
        # Check if quotation exists
        existing = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        # Check if quotation can be edited
        if existing["status"] == "Approved":
            raise HTTPException(
                status_code=400, 
                detail="Approved quotations cannot be edited"
            )
        
        # Update quotation
        quotation_data["modified_by"] = current_user.id
        quotation_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.quotations.update_one(
            {"id": quotation_id},
            {"$set": quotation_data}
        )
        
        # Log audit trail
        audit_log = QuotationAuditLog(
            quotation_id=quotation_id,
            table_name="quotations",
            record_id=quotation_id,
            action="update",
            user_id=current_user.id,
            user_role="user"
        )
        await db.quotation_audit_log.insert_one(audit_log.dict())
        
        return APIResponse(success=True, message="Quotation updated successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Quotation Phases
@api_router.post("/quotations/{quotation_id}/phases", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_quotation_phase(quotation_id: str, phase_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new phase in a quotation"""
    try:
        # Verify quotation exists
        quotation = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        phase_data["quotation_id"] = quotation_id
        phase_data["created_by"] = current_user.id
        phase = QuotationPhase(**phase_data)
        
        await db.quotation_phases.insert_one(phase.dict())
        
        return APIResponse(success=True, message="Phase created successfully", data={"phase_id": phase.id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. Quotation Groups
@api_router.post("/quotations/{quotation_id}/phases/{phase_id}/groups", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_quotation_group(quotation_id: str, phase_id: str, group_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new group in a phase"""
    try:
        # Verify phase exists
        phase = await db.quotation_phases.find_one({"id": phase_id, "quotation_id": quotation_id, "is_deleted": False})
        if not phase:
            raise HTTPException(status_code=404, detail="Phase not found")
        
        group_data["phase_id"] = phase_id
        group_data["created_by"] = current_user.id
        group = QuotationGroup(**group_data)
        
        await db.quotation_groups.insert_one(group.dict())
        
        return APIResponse(success=True, message="Group created successfully", data={"group_id": group.id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Quotation Items
@api_router.post("/quotations/{quotation_id}/groups/{group_id}/items", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def create_quotation_item(quotation_id: str, group_id: str, item_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new item in a group"""
    try:
        # Verify group exists
        group = await db.quotation_groups.find_one({"id": group_id, "is_deleted": False})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        item_data["group_id"] = group_id
        item_data["created_by"] = current_user.id
        item = QuotationItem(**item_data)
        
        await db.quotation_items.insert_one(item.dict())
        
        # Create yearly allocations (Y1-Y10)
        if item_data.get("create_yearly_allocations", True):
            for year in range(1, 11):
                yearly_data = QuotationItemYearly(
                    item_id=item.id,
                    year_no=year,
                    allocated_otp=item.net_otp if year == 1 else 0.0,
                    allocated_recurring=item.net_recurring if year > 1 else 0.0,
                    year_total=item.net_otp if year == 1 else item.net_recurring
                )
                await db.quotation_item_yearly.insert_one(yearly_data.dict())
        
        return APIResponse(success=True, message="Item created successfully", data={"item_id": item.id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Quotation Approval Workflow
@api_router.post("/quotations/{quotation_id}/submit", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def submit_quotation(quotation_id: str, current_user: User = Depends(get_current_user)):
    """Submit quotation for approval"""
    try:
        # Get quotation
        quotation = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        if quotation["status"] != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft quotations can be submitted")
        
        # Update status to Unapproved
        await db.quotations.update_one(
            {"id": quotation_id},
            {"$set": {
                "status": "Unapproved",
                "submitted_by": current_user.id,
                "submitted_at": datetime.now(timezone.utc),
                "modified_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Create version snapshot
        quotation_snapshot = await get_quotation(quotation_id, current_user)
        version = QuotationVersion(
            quotation_id=quotation_id,
            version_number=1,
            version_name="Initial Submission",
            snapshot_data=str(quotation_snapshot.data),
            created_by=current_user.id
        )
        await db.quotation_versions.insert_one(version.dict())
        
        # Log audit trail
        audit_log = QuotationAuditLog(
            quotation_id=quotation_id,
            table_name="quotations",
            record_id=quotation_id,
            action="submit",
            user_id=current_user.id,
            user_role="user"
        )
        await db.quotation_audit_log.insert_one(audit_log.dict())
        
        return APIResponse(success=True, message="Quotation submitted successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/quotations/{quotation_id}/approve", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def approve_quotation(quotation_id: str, current_user: User = Depends(get_current_user)):
    """Approve quotation - only Commercial Approver, Sales Manager, or Admin roles"""
    try:
        # Check user role for approval permissions
        user_doc = await db.users.find_one({"id": current_user.id, "is_deleted": False})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        role = await db.roles.find_one({"id": user_doc["role_id"], "is_deleted": False})
        if not role:
            raise HTTPException(status_code=404, detail="User role not found")
        
        # Check if user has approval permissions
        allowed_roles = ["Admin", "Commercial Approver", "Sales Manager"]
        if role["name"] not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient permissions. Only {', '.join(allowed_roles)} can approve quotations"
            )
        
        # Get quotation
        quotation = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        if quotation["status"] != "Unapproved":
            raise HTTPException(status_code=400, detail="Only Unapproved quotations can be approved")
        
        # Update status to Approved
        await db.quotations.update_one(
            {"id": quotation_id},
            {"$set": {
                "status": "Approved",
                "approved_by": current_user.id,
                "approved_at": datetime.now(timezone.utc),
                "modified_by": current_user.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Log audit trail
        audit_log = QuotationAuditLog(
            quotation_id=quotation_id,
            table_name="quotations",
            record_id=quotation_id,
            action="approve",
            user_id=current_user.id,
            user_role=role["name"]
        )
        await db.quotation_audit_log.insert_one(audit_log.dict())
        
        return APIResponse(success=True, message="Quotation approved successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/quotations/{quotation_id}", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def delete_quotation(quotation_id: str, current_user: User = Depends(get_current_user)):
    """Delete quotation - only allowed for Draft/Unapproved status"""
    try:
        # Get quotation
        quotation = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        # Check if quotation can be deleted
        if quotation["status"] not in ["Draft", "Unapproved"]:
            raise HTTPException(
                status_code=400, 
                detail="Only Draft or Unapproved quotations can be deleted"
            )
        
        # Soft delete the quotation and related data
        await db.quotations.update_one(
            {"id": quotation_id},
            {"$set": {
                "is_deleted": True,
                "deleted_by": current_user.id,
                "deleted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Soft delete related phases, groups, and items
        await db.quotation_phases.update_many(
            {"quotation_id": quotation_id},
            {"$set": {"is_deleted": True}}
        )
        
        await db.quotation_groups.update_many(
            {"phase_id": {"$in": [
                phase["id"] for phase in await db.quotation_phases.find(
                    {"quotation_id": quotation_id}
                ).to_list(None)
            ]}},
            {"$set": {"is_deleted": True}}
        )
        
        await db.quotation_items.update_many(
            {"group_id": {"$in": [
                group["id"] for group in await db.quotation_groups.find(
                    {"phase_id": {"$in": [
                        phase["id"] for phase in await db.quotation_phases.find(
                            {"quotation_id": quotation_id}
                        ).to_list(None)
                    ]}}
                ).to_list(None)
            ]}},
            {"$set": {"is_deleted": True}}
        )
        
        # Log audit trail
        audit_log = QuotationAuditLog(
            quotation_id=quotation_id,
            table_name="quotations",
            record_id=quotation_id,
            action="delete",
            user_id=current_user.id,
            user_role="user"
        )
        await db.quotation_audit_log.insert_one(audit_log.dict())
        
        return APIResponse(success=True, message="Quotation deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. Quotation Export
@api_router.get("/quotations/{quotation_id}/export/{format}", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def export_quotation(quotation_id: str, format: str, current_user: User = Depends(get_current_user)):
    """Export quotation in specified format (pdf, excel, word)"""
    try:
        if format not in ["pdf", "excel", "word"]:
            raise HTTPException(status_code=400, detail="Invalid export format")
        
        # Get quotation data
        quotation_response = await get_quotation(quotation_id, current_user)
        quotation_data = quotation_response.data
        
        # Get export template
        template = await db.export_templates.find_one({
            "template_type": format,
            "is_default": True,
            "is_deleted": False
        })
        
        if not template:
            template = await db.export_templates.find_one({
                "template_type": format,
                "is_deleted": False
            })
        
        # Generate export file (mock implementation)
        export_filename = f"quotation_{quotation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}"
        
        # Log audit trail
        audit_log = QuotationAuditLog(
            quotation_id=quotation_id,
            table_name="quotations",
            record_id=quotation_id,
            action="export",
            user_id=current_user.id,
            user_role="user",
            new_value=f"Export format: {format}"
        )
        await db.quotation_audit_log.insert_one(audit_log.dict())
        
        return APIResponse(
            success=True, 
            message=f"Quotation exported successfully",
            data={
                "filename": export_filename,
                "quotation_data": quotation_data,
                "template_used": template.get("template_name", "Default") if template else "Default"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 7. Discount Rules Management
@api_router.get("/discount-rules", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_discount_rules(current_user: User = Depends(get_current_user)):
    """Get all active discount rules"""
    try:
        rules = await db.discount_rules.find({"is_active": True, "is_deleted": False}).sort("priority_order", 1).to_list(1000)
        
        for rule in rules:
            rule.pop("_id", None)
        
        return APIResponse(success=True, message="Discount rules retrieved successfully", data=rules)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8. Customer Quotation Access
@api_router.post("/quotations/{quotation_id}/generate-access-token", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def generate_customer_access_token(quotation_id: str, access_data: dict, current_user: User = Depends(get_current_user)):
    """Generate access token for customer to view quotation"""
    try:
        # Verify quotation exists and is approved/sent
        quotation = await db.quotations.find_one({"id": quotation_id, "is_deleted": False})
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        
        if quotation["status"] not in ["approved", "sent"]:
            raise HTTPException(status_code=400, detail="Only approved or sent quotations can be shared with customers")
        
        # Generate unique access token
        access_token = str(uuid.uuid4())
        
        # Set expiry (default 30 days)
        expires_at = datetime.now(timezone.utc) + timedelta(days=access_data.get("validity_days", 30))
        
        # Create access record
        customer_access = CustomerQuotationAccess(
            quotation_id=quotation_id,
            access_token=access_token,
            customer_email=access_data["customer_email"],
            can_view_pricing=access_data.get("can_view_pricing", True),
            can_download_pdf=access_data.get("can_download_pdf", True),
            can_provide_feedback=access_data.get("can_provide_feedback", True),
            expires_at=expires_at,
            created_by=current_user.id
        )
        
        await db.customer_quotation_access.insert_one(customer_access.dict())
        
        return APIResponse(
            success=True,
            message="Customer access token generated successfully",
            data={
                "access_token": access_token,
                "access_url": f"/customer/quotation/{access_token}",
                "expires_at": expires_at.isoformat()
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PRODUCT & PRICING MASTER ENDPOINTS =====

# Product Catalog APIs
@api_router.get("/products/catalog", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_product_catalog(current_user: User = Depends(get_current_user)):
    """Get all products with hierarchy for catalog"""
    try:
        products = await db.core_product_model.find({"is_deleted": False}).sort("primary_category", 1).to_list(1000)
        
        # Remove MongoDB _id fields
        for product in products:
            product.pop("_id", None)
        
        return APIResponse(success=True, message="Product catalog retrieved successfully", data=products)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/products/{product_id}/pricing", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_product_pricing(
    product_id: str, 
    asOf: str = None,  # Phase Start Date for validity check
    rateCardId: str = None,  # Rate card ID for pricing
    customer_id: str = None,  # For customer-specific pricing
    current_user: User = Depends(get_current_user)
):
    """Get pricing for a specific product with priority logic"""
    try:
        from datetime import datetime
        import pytz
        
        # Parse asOf date or use current date
        if asOf:
            try:
                as_of_date = datetime.fromisoformat(asOf.replace('Z', '+00:00'))
            except:
                as_of_date = datetime.now(timezone.utc)
        else:
            as_of_date = datetime.now(timezone.utc)
        
        # Priority logic: Customer-specific → Segment/Region → Default/Global ACTIVE
        # Build query with rate card preference
        query = {
            "core_product_id": product_id,
            "is_active": True,
            "is_deleted": False
        }
        
        # If specific rate card requested, try to find pricing for that card first
        if rateCardId:
            query["pricing_list_id"] = rateCardId
        
        pricing_models = await db.pricing_models.find(query).to_list(100)
        
        # If no pricing found for specific rate card, fall back to any active pricing
        if not pricing_models and rateCardId:
            fallback_query = {
                "core_product_id": product_id,
                "is_active": True,
                "is_deleted": False
            }
            pricing_models = await db.pricing_models.find(fallback_query).to_list(100)
        
        if not pricing_models:
            return APIResponse(
                success=False, 
                message=f"No active pricing found for product {product_id}. Please configure pricing in Master Data.", 
                data=None
            )
        
        # For now, return the first active pricing model
        # TODO: Implement proper priority logic when pricing_list_id relationships are established
        selected_pricing = pricing_models[0]
        
        # Remove MongoDB _id fields
        selected_pricing.pop("_id", None)
        
        # Format response with user-expected fields
        pricing_response = {
            "otp_price": selected_pricing.get("selling_price", 0),
            "recurring_price": selected_pricing.get("recurring_selling_price", 0),
            "price_list_id": selected_pricing.get("pricing_list_id", rateCardId or "default"),
            "currency": "USD",  # Default currency
            "product_id": product_id,
            "pricing_model_id": selected_pricing.get("id"),
            "valid_from": as_of_date.isoformat(),
            "has_active_price": True,
            "rate_card_used": rateCardId or "default"
        }
        
        return APIResponse(
            success=True, 
            message="Product pricing retrieved successfully", 
            data=pricing_response
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/products/search", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def search_products(q: str = "", category: str = "", current_user: User = Depends(get_current_user)):
    """Search products by name or category"""
    try:
        query = {"is_deleted": False}
        
        if q:
            query["$or"] = [
                {"core_product_name": {"$regex": q, "$options": "i"}},
                {"skucode": {"$regex": q, "$options": "i"}},
                {"product_description": {"$regex": q, "$options": "i"}}
            ]
        
        if category:
            query["$or"] = query.get("$or", []) + [
                {"primary_category": {"$regex": category, "$options": "i"}},
                {"secondary_category": {"$regex": category, "$options": "i"}},
                {"tertiary_category": {"$regex": category, "$options": "i"}}
            ]
        
        products = await db.core_product_model.find(query).sort("core_product_name", 1).to_list(1000)
        
        # Remove MongoDB _id fields
        for product in products:
            product.pop("_id", None)
        
        return APIResponse(success=True, message="Products searched successfully", data=products)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Pricing Lists APIs
@api_router.get("/pricing-lists", response_model=APIResponse)
@require_permission("/opportunities", "view")
async def get_pricing_lists(current_user: User = Depends(get_current_user)):
    """Get all active pricing lists"""
    try:
        pricing_lists = await db.pricing_list.find({"is_active": True, "is_deleted": False}).sort("name", 1).to_list(1000)
        
        # Remove MongoDB _id fields
        for pricing_list in pricing_lists:
            pricing_list.pop("_id", None)
        
        return APIResponse(success=True, message="Pricing lists retrieved successfully", data=pricing_lists)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PRODUCT CATALOG CRUD APIs =====

@api_router.post("/products/catalog", response_model=APIResponse)
@require_permission("/master-data", "create")
async def create_product(product_data: CoreProductModel, current_user: User = Depends(get_current_user)):
    """Create a new product"""
    try:
        # Check for duplicate SKU
        existing = await db.core_product_model.find_one({
            "skucode": product_data.skucode,
            "is_deleted": False
        })
        if existing:
            raise HTTPException(status_code=400, detail="SKU code already exists")
        
        product_data.created_by = current_user.id
        product_dict = product_data.dict()
        
        result = await db.core_product_model.insert_one(product_dict)
        product_dict.pop("_id", None)
        
        return APIResponse(success=True, message="Product created successfully", data=product_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/products/catalog/{product_id}", response_model=APIResponse)
@require_permission("/master-data", "edit")
async def update_product(product_id: str, product_data: CoreProductModel, current_user: User = Depends(get_current_user)):
    """Update an existing product"""
    try:
        # Check if product exists
        existing = await db.core_product_model.find_one({"id": product_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check for duplicate SKU (excluding current product)
        sku_check = await db.core_product_model.find_one({
            "skucode": product_data.skucode,
            "id": {"$ne": product_id},
            "is_deleted": False
        })
        if sku_check:
            raise HTTPException(status_code=400, detail="SKU code already exists")
        
        product_data.updated_at = datetime.now(timezone.utc)
        update_dict = product_data.dict()
        update_dict.pop("id", None)  # Don't update ID
        
        result = await db.core_product_model.update_one(
            {"id": product_id},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Product not found or no changes made")
        
        updated_product = await db.core_product_model.find_one({"id": product_id})
        updated_product.pop("_id", None)
        
        return APIResponse(success=True, message="Product updated successfully", data=updated_product)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/products/catalog/{product_id}", response_model=APIResponse)
@require_permission("/master-data", "delete")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a product"""
    try:
        result = await db.core_product_model.update_one(
            {"id": product_id, "is_deleted": False},
            {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return APIResponse(success=True, message="Product deleted successfully", data={"id": product_id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PRICING LISTS CRUD APIs =====

@api_router.post("/pricing-lists", response_model=APIResponse)
@require_permission("/master-data", "create")
async def create_pricing_list(pricing_data: PricingList, current_user: User = Depends(get_current_user)):
    """Create a new pricing list"""
    try:
        # Check for duplicate name
        existing = await db.pricing_list.find_one({
            "name": pricing_data.name,
            "is_deleted": False
        })
        if existing:
            raise HTTPException(status_code=400, detail="Pricing list name already exists")
        
        pricing_data.created_by = current_user.id
        pricing_dict = pricing_data.dict()
        
        result = await db.pricing_list.insert_one(pricing_dict)
        pricing_dict.pop("_id", None)
        
        return APIResponse(success=True, message="Pricing list created successfully", data=pricing_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/pricing-lists/{pricing_list_id}", response_model=APIResponse)
@require_permission("/master-data", "edit")
async def update_pricing_list(pricing_list_id: str, pricing_data: PricingList, current_user: User = Depends(get_current_user)):
    """Update an existing pricing list"""
    try:
        # Check if pricing list exists
        existing = await db.pricing_list.find_one({"id": pricing_list_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Pricing list not found")
        
        # Check for duplicate name (excluding current list)
        name_check = await db.pricing_list.find_one({
            "name": pricing_data.name,
            "id": {"$ne": pricing_list_id},
            "is_deleted": False
        })
        if name_check:
            raise HTTPException(status_code=400, detail="Pricing list name already exists")
        
        pricing_data.updated_at = datetime.now(timezone.utc)
        update_dict = pricing_data.dict()
        update_dict.pop("id", None)  # Don't update ID
        
        result = await db.pricing_list.update_one(
            {"id": pricing_list_id},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Pricing list not found or no changes made")
        
        updated_list = await db.pricing_list.find_one({"id": pricing_list_id})
        updated_list.pop("_id", None)
        
        return APIResponse(success=True, message="Pricing list updated successfully", data=updated_list)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/pricing-lists/{pricing_list_id}", response_model=APIResponse)
@require_permission("/master-data", "delete")
async def delete_pricing_list(pricing_list_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a pricing list"""
    try:
        result = await db.pricing_list.update_one(
            {"id": pricing_list_id, "is_deleted": False},
            {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Pricing list not found")
        
        return APIResponse(success=True, message="Pricing list deleted successfully", data={"id": pricing_list_id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PRICING MODELS CRUD APIs =====

@api_router.get("/pricing-models", response_model=APIResponse)
@require_permission("/master-data", "view")
async def get_pricing_models(current_user: User = Depends(get_current_user)):
    """Get all pricing models with product names"""
    try:
        pricing_models = await db.pricing_models.find({"is_deleted": False}).to_list(1000)
        
        # Enrich with product names
        for model in pricing_models:
            product = await db.core_product_model.find_one({"id": model["core_product_id"]})
            if product:
                model["product_name"] = product["core_product_name"]
                model["sku_code"] = product["skucode"]
            model.pop("_id", None)
        
        return APIResponse(success=True, message="Pricing models retrieved successfully", data=pricing_models)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/pricing-models", response_model=APIResponse)
@require_permission("/master-data", "create")
async def create_pricing_model(pricing_data: PricingModel, current_user: User = Depends(get_current_user)):
    """Create a new pricing model"""
    try:
        # Verify product exists
        product = await db.core_product_model.find_one({"id": pricing_data.core_product_id})
        if not product:
            raise HTTPException(status_code=400, detail="Product not found")
        
        pricing_dict = pricing_data.dict()
        result = await db.pricing_models.insert_one(pricing_dict)
        pricing_dict.pop("_id", None)
        
        return APIResponse(success=True, message="Pricing model created successfully", data=pricing_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/pricing-models/{pricing_model_id}", response_model=APIResponse)
@require_permission("/master-data", "edit")
async def update_pricing_model(pricing_model_id: str, pricing_data: PricingModel, current_user: User = Depends(get_current_user)):
    """Update an existing pricing model"""
    try:
        # Check if pricing model exists
        existing = await db.pricing_models.find_one({"id": pricing_model_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Pricing model not found")
        
        # Verify product exists
        product = await db.core_product_model.find_one({"id": pricing_data.core_product_id})
        if not product:
            raise HTTPException(status_code=400, detail="Product not found")
        
        pricing_data.updated_at = datetime.now(timezone.utc)
        update_dict = pricing_data.dict()
        update_dict.pop("id", None)  # Don't update ID
        
        result = await db.pricing_models.update_one(
            {"id": pricing_model_id},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Pricing model not found or no changes made")
        
        updated_model = await db.pricing_models.find_one({"id": pricing_model_id})
        updated_model.pop("_id", None)
        
        return APIResponse(success=True, message="Pricing model updated successfully", data=updated_model)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/pricing-models/{pricing_model_id}", response_model=APIResponse)
@require_permission("/master-data", "delete")
async def delete_pricing_model(pricing_model_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a pricing model"""
    try:
        result = await db.pricing_models.update_one(
            {"id": pricing_model_id, "is_deleted": False},
            {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Pricing model not found")
        
        return APIResponse(success=True, message="Pricing model deleted successfully", data={"id": pricing_model_id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Category Hierarchy API
@api_router.get("/categories/hierarchy", response_model=APIResponse)
async def get_category_hierarchy(current_user: User = Depends(get_current_user)):
    """Get category hierarchy for product organization"""
    try:
        # Aggregate categories from products
        pipeline = [
            {"$match": {"is_deleted": False}},
            {"$group": {
                "_id": {
                    "primary": "$primary_category",
                    "secondary": "$secondary_category",
                    "tertiary": "$tertiary_category",
                    "fourth": "$fourth_category",
                    "fifth": "$fifth_category"
                }
            }},
            {"$sort": {"_id.primary": 1, "_id.secondary": 1}}
        ]
        
        result = await db.core_product_model.aggregate(pipeline).to_list(1000)
        
        # Structure the hierarchy
        hierarchy = {}
        for item in result:
            cat = item["_id"]
            if cat["primary"] and cat["primary"] not in hierarchy:
                hierarchy[cat["primary"]] = {}
            if cat["secondary"] and cat["primary"]:
                if cat["secondary"] not in hierarchy[cat["primary"]]:
                    hierarchy[cat["primary"]][cat["secondary"]] = {}
                if cat["tertiary"] and cat["tertiary"] not in hierarchy[cat["primary"]][cat["secondary"]]:
                    hierarchy[cat["primary"]][cat["secondary"]][cat["tertiary"]] = {}
        
        return APIResponse(success=True, message="Category hierarchy retrieved successfully", data=hierarchy)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== TESTING HELPER ENDPOINTS =====

@api_router.post("/test/advance-opportunity-to-l4/{opportunity_id}", response_model=APIResponse)
@require_permission("/opportunities", "edit")
async def advance_opportunity_to_l4(opportunity_id: str, current_user: User = Depends(get_current_user)):
    """Helper endpoint to advance opportunity to L4 stage for QMS testing"""
    try:
        # Check if opportunity exists
        opportunity = await db.opportunities.find_one({"id": opportunity_id, "is_deleted": False})
        if not opportunity:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        # Update opportunity to L4 stage with basic progression data
        update_data = {
            "stage_id": "L4",
            "current_stage_id": "L4",
            "current_stage_name": "Technical Qualification",
            "stage_form_data": {
                "region": "North America",
                "product_interest": "Enterprise Software",
                "assigned_rep": current_user.id,
                "status": "Qualified",
                "expected_revenue": opportunity.get("expected_revenue", 100000),
                "currency_id": opportunity.get("currency_id", "1"),
                "convert_date": "2025-12-31",
                "needs_assessment": "Technical requirements gathered",
                "proposal_details": "Proposal prepared and submitted",
                "technical_requirements": "Cloud infrastructure, scalability, security",
                "compliance_requirements": "GDPR, SOC2, ISO27001",
                "solution_architecture": "Microservices architecture with API gateway"
            },
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.opportunities.update_one(
            {"id": opportunity_id},
            {"$set": update_data}
        )
        
        # Log stage transition
        stage_transition = {
            "opportunity_id": opportunity_id,
            "from_stage": opportunity.get("stage_id", "L1"),
            "to_stage": "L4",
            "user_id": current_user.id,
            "transition_date": datetime.now(timezone.utc),
            "notes": "Advanced to L4 for QMS testing"
        }
        await db.stage_transitions.insert_one(stage_transition)
        
        return APIResponse(
            success=True,
            message="Opportunity successfully advanced to L4 (Technical Qualification) stage",
            data={"opportunity_id": opportunity_id, "new_stage": "L4"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END TESTING HELPER ENDPOINTS =====

# ===== END PRODUCT & PRICING ENDPOINTS =====

# ===== END QMS ENDPOINTS =====

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()