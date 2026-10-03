from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.models.project import Project
from app.services.project_service import project_service

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=List[Dict[str, Any]])
async def list_projects():
    return project_service.list_projects()

@router.post("", response_model=Project)
async def create_project(project: Project):
    try:
        return project_service.create_project(project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=Project)
async def update_project(project_id: str, project: Project):
    if project.id != project_id:
        project.id = project_id
    try:
        return project_service.save_project(project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save project: {str(e)}")

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    success = project_service.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or could not be deleted")
    return {"status": "deleted", "id": project_id}

@router.post("/{project_id}/duplicate", response_model=Project)
async def duplicate_project(project_id: str):
    original = project_service.get_project(project_id)
    if not original:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create duplicate
    import uuid
    new_data = original.model_dump()
    new_data["id"] = str(uuid.uuid4())
    new_data["name"] = f"{original.name} (Copy)"
    new_data["project_dir"] = None
    
    new_project = Project(**new_data)
    return project_service.create_project(new_project)
