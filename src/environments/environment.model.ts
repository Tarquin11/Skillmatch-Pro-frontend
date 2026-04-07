export interface AppEnvironment {
  production: boolean;
  stage: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
}

