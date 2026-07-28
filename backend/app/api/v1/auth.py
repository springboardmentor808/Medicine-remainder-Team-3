from fastapi import APIRouter, Response

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
def login(response: Response):
    response.set_cookie(key="access_token", value="Bearer placeholder")
    return {"message": "Login endpoint stub"}
