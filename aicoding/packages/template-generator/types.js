/**
 * @typedef {{ path: string, content: string }} TemplateFile
 *
 * @typedef {{ name: string, value: string, type: string }} TemplateOption
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   category: 'frontend'|'backend'|'fullstack'|'api'|'cli',
 *   language: 'javascript'|'typescript'|'python'|'java'|'go'|'rust',
 *   framework?: string,
 *   version?: string,
 *   files: TemplateFile[],
 *   options?: Record<string, TemplateOption[]>
 * }} TemplateDefinition
 *
 * @typedef {{
 *   projectName: string,
 *   templateId: string,
 *   author?: string,
 *   description?: string,
 *   [key: string]: string|undefined
 * }} TemplateParams
 *
 * @typedef {{
 *   files: TemplateFile[],
 *   summary: string,
 *   scaffoldInfo: {
 *     projectName: string,
 *     templateId: string,
 *     templateName: string,
 *     fileCount: number
 *   }
 * }} GeneratedProject
 */

export {};
