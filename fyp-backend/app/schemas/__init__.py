# __init__.py
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.schemas.profile import UserProfile, UserProfileResponse, UserProfileUpdate
from app.schemas.program import Program, SkillResource, UniversityProgram
from app.schemas.recommendation import GapAnalysisResult, JobRecommendation, MajorRecommendation, ProgramRecommendation, RecommendationRequest
from app.schemas.skills import ExtractedSkill, ExtractSkillsRequest, ExtractSkillsResponse
from app.schemas.user import Token, TokenData, UserCreate, UserLogin, UserRead, UserUpdate

__all__ = [
	"AuthResponse",
	"LoginRequest",
	"RegisterRequest",
	"UserProfile",
	"UserProfileUpdate",
	"UserProfileResponse",
	"Program",
	"SkillResource",
	"UniversityProgram",
	"GapAnalysisResult",
	"JobRecommendation",
	"MajorRecommendation",
	"ProgramRecommendation",
	"RecommendationRequest",
	"ExtractedSkill",
	"ExtractSkillsRequest",
	"ExtractSkillsResponse",
	"Token",
	"TokenData",
	"UserCreate",
	"UserLogin",
	"UserRead",
	"UserUpdate",
]
