import { createSuccessResponse } from '../shared/index.js';
import { createPlanner } from './planner.js';
import { createExecutor } from './executor.js';
import { createReviewer } from './reviewer.js';
import { createSummarizer } from './summarizer.js';
import { createTemplateGenerator } from '../template-generator/index.js';

function buildMessages(context, phase, taskState) {
  return [
    {
      role: 'system',
      content: [
        '你是一个 AI Coding Agent，负责在工作区中执行编码任务。',
        '你必须优先使用 tools 完成文件读取、写入和命令执行。',
        '不要编造工具执行结果。',
        '当任务需要操作文件或命令时，优先调用工具。',
        '当任务完成时，用简洁中文总结。',
        `当前阶段：${phase}`,
        `上下文预算：最多包含 ${context.contextBudget?.includedFiles?.length ?? 0} 个文件，最大字符数 ${context.contextBudget?.maxChars ?? 0}。`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          prompt: context.prompt,
          selectedFile: context.selectedFile,
          selectedFileContent: context.selectedFileContent,
          workspaceSummary: context.workspaceSummary,
          contextBudget: context.contextBudget,
          phase,
          taskState,
        },
        null,
        2,
      ),
    },
  ];
}

function createTaskState(prompt, selectedFile, context) {
  return {
    status: 'planning',
    prompt,
    selectedFile,
    phases: [],
    contextBudget: context.contextBudget,
    toolCalls: [],
    toolResults: [],
    summary: '',
  };
}

function recordPhase(taskState, phase, note = '') {
  taskState.status = phase;
  taskState.phases.push({ phase, note, at: new Date().toISOString() });
}

export function createAgentCore(contextBuilder, toolGateway, llmClient = null) {
  const planner = createPlanner();
  const executor = createExecutor(toolGateway);
  const reviewer = createReviewer();
  const summarizer = createSummarizer();
  const templateGenerator = createTemplateGenerator();

  return {
    async preview(prompt, selectedFile = null, onChunk = null) {
      const context = contextBuilder.buildForPrompt(prompt, selectedFile);
      const taskState = createTaskState(prompt, selectedFile, context);
      const plan = planner.plan(context);
      recordPhase(taskState, 'planning', '构建上下文并分析需求');

      if (!llmClient) {
        const fallback = '理解需求；构建上下文；生成/修改文件；执行命令验证；回显结果。';
        recordPhase(taskState, 'execution', 'mock 模式直接返回结果');
        const review = reviewer.review({ content: fallback, toolResults: [] });
        recordPhase(taskState, 'review', review.summary);
        taskState.summary = summarizer.summarize({ plan, execution: { content: fallback }, review });
        if (onChunk) onChunk(fallback);
        return createSuccessResponse({ status: 'mocked', output: fallback, context, taskState, plan });
      }

      const messages = buildMessages(context, taskState.status, taskState);
      recordPhase(taskState, 'execution', '开始请求模型并执行工具');
      const { result, content, toolCalls, toolResults } = await executor.runModel(llmClient, messages, onChunk);

      taskState.toolCalls.push(...toolCalls);
      taskState.toolResults.push(...toolResults);

      const review = reviewer.review({ content, toolResults });
      recordPhase(taskState, 'review', review.summary);
      taskState.summary = summarizer.summarize({ plan, execution: { content, toolCalls, toolResults }, review });
      taskState.status = 'done';

      const createdFiles = toolResults
        .filter((item) => item.name === 'write_file' && item.result?.ok)
        .map((item) => item.result.file);

      return createSuccessResponse({
        status: 'ok',
        model: llmClient.model,
        output: content,
        toolCalls,
        toolResults,
        createdFiles,
        transcript: [{ role: 'assistant', content, toolCalls }],
        raw: result,
        context,
        taskState,
        plan,
        review,
      });
    },

    async generateScaffold(projectParams, onChunk = null) {
      const taskState = {
        status: 'generating_scaffold',
        prompt: `生成 ${projectParams.templateId} 模板项目：${projectParams.projectName}`,
        selectedFile: null,
        phases: [],
        contextBudget: { includedFiles: [], maxChars: 0, maxFiles: 0 },
        toolCalls: [],
        toolResults: [],
        summary: '',
      };

      try {
        recordPhase(taskState, 'scaffold_planning', `选择模板 ${projectParams.templateId}`);
        const generated = templateGenerator.generateProject(projectParams.templateId, projectParams);
        recordPhase(taskState, 'scaffold_generation', `生成 ${generated.files.length} 个文件`);

        for (const file of generated.files) {
          const result = await toolGateway.writeFile(file.path, file.content);
          taskState.toolResults.push({ name: 'write_file', result });
          if (onChunk) {
            onChunk({
              type: 'tool',
              tool: 'write_file',
              summary: `创建文件: ${file.path}`,
            });
          }
        }

        recordPhase(taskState, 'scaffold_complete', '项目骨架生成完成');
        taskState.status = 'done';
        taskState.summary = `已成功生成 ${generated.scaffoldInfo.templateName} 项目骨架，包含 ${generated.scaffoldInfo.fileCount} 个文件。项目名称：${generated.scaffoldInfo.projectName}`;

        return createSuccessResponse({
          status: 'scaffold_ok',
          scaffoldInfo: generated.scaffoldInfo,
          files: generated.files.map((f) => ({ path: f.path })),
          output: generated.summary,
          taskState,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        recordPhase(taskState, 'scaffold_error', message);
        taskState.status = 'failed';
        return createSuccessResponse({
          status: 'scaffold_error',
          error: message,
          taskState,
        });
      }
    },

    getTemplates() {
      return templateGenerator.getTemplateList();
    },

    getTemplatesByCategory(category) {
      return templateGenerator.getTemplatesByCategory(category);
    },

    getTemplateDetail(templateId) {
      return templateGenerator.getTemplateDetail(templateId);
    },

    readFile(path) {
      return toolGateway.readFile(path);
    },

    async writeFile(path, content) {
      return toolGateway.writeFile(path, content);
    },

    async runCommand(command) {
      return toolGateway.runCommand(command);
    },
  };
}
