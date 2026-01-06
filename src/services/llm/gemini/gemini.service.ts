export interface GeminiConfig {
  apiKey: string;
}

export interface GeminiModelSpecificConfig extends GeminiConfig {
  modelName: string;
}
