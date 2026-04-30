import { getTemplate, listTemplates, listTemplatesByCategory } from "./templates.js";

export function createTemplateGenerator() {
  function renderValue(input, params) {
    let rendered = input.replace(/{{projectName}}/g, params.projectName);

    if (params.author) {
      rendered = rendered.replace(/{{author}}/g, params.author);
    }
    if (params.description) {
      rendered = rendered.replace(/{{description}}/g, params.description);
    }

    for (const [key, value] of Object.entries(params)) {
      if (
        value !== undefined &&
        !["projectName", "templateId", "author", "description"].includes(key)
      ) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), value);
      }
    }

    return rendered;
  }

  function generateProject(templateId, params) {
    const template = getTemplate(templateId);
    if (!template) {
      throw new Error(`模板 "${templateId}" 不存在`);
    }

    const files = template.files.map((file) => ({
      path: renderValue(file.path, params),
      content: renderValue(file.content, params),
    }));

    return {
      files,
      summary: `已生成 ${files.length} 个文件的 ${template.name} 项目骨架`,
      scaffoldInfo: {
        projectName: params.projectName,
        templateId,
        templateName: template.name,
        fileCount: files.length,
      },
    };
  }

  function getTemplateList() {
    return listTemplates().map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      language: item.language,
      framework: item.framework,
      version: item.version,
    }));
  }

  function getTemplatesByCategory(category) {
    return listTemplatesByCategory(category).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      language: item.language,
      framework: item.framework,
      version: item.version,
    }));
  }

  function getTemplateDetail(templateId) {
    const template = getTemplate(templateId);
    if (!template) return null;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      language: template.language,
      framework: template.framework,
      version: template.version,
      fileCount: template.files.length,
      options: template.options,
    };
  }

  return {
    generateProject,
    getTemplateList,
    getTemplatesByCategory,
    getTemplateDetail,
  };
}
