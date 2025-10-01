export interface UserRegister {
    username: string;
    email: string;
    password: string;
}

export interface UserLogin {
    username_or_email: string;
    password: string;
}

export interface MeUser {
    id: number;
    username: string;
    email: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TokenUserResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}