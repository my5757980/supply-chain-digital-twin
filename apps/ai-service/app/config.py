from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AI service configuration, sourced from environment variables.

    See specs/001-supply-chain-digital-twin/quickstart.md for the required
    variable list.

    The LLM is reached through an OpenAI-compatible endpoint (research.md
    §2), so switching providers is a config change rather than a code
    change — only `llm_base_url`, `llm_api_key`, and `llm_model` differ.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM provider (OpenAI-compatible). Defaults target Groq.
    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"

    database_url: str = ""
    api_callback_url: str = "http://localhost:4000"
    service_token: str = ""


settings = Settings()
