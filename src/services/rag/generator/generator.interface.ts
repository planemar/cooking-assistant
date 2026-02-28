export interface GeneratorService {
  generate(question: string): Promise<string>;
}
