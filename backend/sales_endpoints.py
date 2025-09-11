# 2️⃣ Partners CRUD Endpoints
@api_router.get("/partners", response_model=APIResponse)
@require_permission("/partners", "view")
async def get_partners(current_user: User = Depends(get_current_user)):
    """Get all partners"""
    try:
        partners = await db.partners.find({"is_deleted": False}).to_list(1000)
        
        # Enrich with job function names
        enriched_partners = []
        for partner in partners:
            partner_data = Partner(**partner).dict()
            job_function = await db.job_function_master.find_one({"job_function_id": partner["job_function_id"], "is_deleted": False})
            partner_data["job_function_name"] = job_function["job_function_name"] if job_function else "Unknown"
            enriched_partners.append(partner_data)
        
        return APIResponse(success=True, message="Partners retrieved successfully", data=enriched_partners)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/partners", response_model=APIResponse)
@require_permission("/partners", "create")
async def create_partner(partner_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new partner"""
    try:
        # Validate required fields
        required_fields = ["first_name", "last_name", "email", "job_function_id"]
        for field in required_fields:
            if field not in partner_data or not partner_data[field]:
                raise HTTPException(status_code=400, detail=f"{field} is required")
        
        # Check if email already exists
        existing = await db.partners.find_one({"email": partner_data["email"], "is_deleted": False})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        
        # Validate job function exists
        job_function = await db.job_function_master.find_one({"job_function_id": partner_data["job_function_id"], "is_deleted": False})
        if not job_function:
            raise HTTPException(status_code=400, detail="Invalid job function")
        
        # Create partner
        partner_data["created_by"] = current_user.id
        partner_data["updated_by"] = current_user.id
        new_partner = Partner(**partner_data)
        await db.partners.insert_one(new_partner.dict())
        
        # Log activity
        await log_activity(ActivityLog(user_id=current_user.id, action=f"Created partner: {partner_data['first_name']} {partner_data['last_name']}"))
        
        return APIResponse(success=True, message="Partner created successfully", data={"partner_id": new_partner.partner_id})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/partners/{partner_id}", response_model=APIResponse)
@require_permission("/partners", "view")
async def get_partner(partner_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific partner"""
    try:
        partner = await db.partners.find_one({"partner_id": partner_id, "is_deleted": False})
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        # Enrich with job function name
        partner_data = Partner(**partner).dict()
        job_function = await db.job_function_master.find_one({"job_function_id": partner["job_function_id"], "is_deleted": False})
        partner_data["job_function_name"] = job_function["job_function_name"] if job_function else "Unknown"
        
        return APIResponse(success=True, message="Partner retrieved successfully", data=partner_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/partners/{partner_id}", response_model=APIResponse)
@require_permission("/partners", "edit")
async def update_partner(partner_id: str, partner_data: dict, current_user: User = Depends(get_current_user)):
    """Update a partner"""
    try:
        # Check if partner exists
        existing = await db.partners.find_one({"partner_id": partner_id, "is_deleted": False})
        if not existing:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        # Check email uniqueness if email is being updated
        if "email" in partner_data and partner_data["email"] != existing["email"]:
            email_exists = await db.partners.find_one({"email": partner_data["email"], "is_deleted": False})
            if email_exists and email_exists["partner_id"] != partner_id:
                raise HTTPException(status_code=400, detail="Email already exists")
        
        # Validate job function if provided
        if "job_function_id" in partner_data:
            job_function = await db.job_function_master.find_one({"job_function_id": partner_data["job_function_id"], "is_deleted": False})
            if not job_function:
                raise HTTPException(status_code=400, detail="Invalid job function")
        
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
    """Get all companies"""
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
        
        # Get related data
        addresses = await db.company_addresses.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        documents = await db.company_documents.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        financials = await db.company_financials.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        contacts = await db.contacts.find({"company_id": company_id, "is_deleted": False}).to_list(100)
        
        company_data["addresses"] = addresses
        company_data["documents"] = documents
        company_data["financials"] = financials
        company_data["contacts"] = contacts
        
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