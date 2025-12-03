import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MindMapData, MindMapNode } from '../types';

export const generateMindMap = async (text: string): Promise<MindMapData> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is missing. Please ensure it is set in your environment.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are an expert academic assistant and translator.
    Your task is to analyze the provided research paper text and generate a structured knowledge graph.

    CRITICAL INSTRUCTION:
    All output must be in **Simplified Chinese (简体中文)**, EXCEPT for the 'quote' field which must remain in the original English.

    TASKS:
    1. **Abstract**: Generate a comprehensive "Executive Summary" (Abstract) in Simplified Chinese.
    2. **Structure (Mind Map)**:
       - **Level 1 Nodes**: Must match the paper's actual **Section Headers** (e.g., "1. Introduction").
         - **ACTION**: Keep the number (1.), but **TRANSLATE the text to Chinese** (e.g., "1. 引言").
       - **Level 2 Nodes**: Must match the **Subsection Headers** (e.g., "2.1 Methodology").
         - **ACTION**: Keep the number (2.1), but **TRANSLATE the text to Chinese**.
       - **Level 3 Nodes**: Summary points. Summarize the key insights of that section in Chinese.
    3. **Research**: Create a "Future Research & Extension Report" in Chinese.

    SCHEMA RULES:
    - 'parentId' should be null for top-level Section Headers (Level 1).
    - 'parentId' for subsections should point to their Section's ID.
    - 'quote': Extract a verbatim English text snippet from the PDF for deep linking.
    - 'pageNumber': Best guess integer.

    Output pure JSON matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            markdownSummary: { type: Type.STRING },
            researchReport: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  parentId: { type: Type.STRING },
                  label: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  quote: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER }
                },
                required: ['id', 'label', 'summary', 'pageNumber']
              }
            }
          },
          required: ['markdownSummary', 'researchReport', 'nodes']
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text from AI");
    }

    // Clean potential markdown code blocks if the model ignores MIME type
    const cleanText = response.text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    
    let data;
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      console.error("JSON Parse Error. Raw text:", response.text);
      throw new Error("Failed to parse AI response as JSON.");
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
       throw new Error("Invalid response structure: 'nodes' array missing");
    }
    
    // Use the tree builder
    const treeData = buildTreeFromFlatList(data.nodes);
    
    treeData.markdownSummary = data.markdownSummary || "Generating summary failed.";
    treeData.researchReport = data.researchReport || "Generating report failed.";
    
    return treeData;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const msg = error.message || "Unknown AI error";
    throw new Error(`Failed to generate mind map: ${msg}`);
  }
};

// Helper to reconstruct the tree from the flat list
function buildTreeFromFlatList(flatNodes: any[]): MindMapData {
    const nodeMap = new Map<string, MindMapNode>();

    // 1. Initialize all nodes
    flatNodes.forEach(raw => {
        // Ensure ID is a string
        const safeId = String(raw.id);
        
        nodeMap.set(safeId, {
            id: safeId,
            label: raw.label || "未命名", // Chinese default
            summary: raw.summary || "",
            quote: raw.quote || "",
            pageNumber: typeof raw.pageNumber === 'number' ? raw.pageNumber : 1,
            children: []
        });
    });

    // 2. Create a Synthetic Root to hold the entire paper structure
    const syntheticRoot: MindMapNode = {
        id: 'root-synthetic',
        label: '文档概览', // Document Overview in Chinese
        summary: '论文交互式导图',
        pageNumber: 1,
        children: []
    };

    // 3. Link children to parents
    flatNodes.forEach(raw => {
        const safeId = String(raw.id);
        const node = nodeMap.get(safeId);
        if (!node) return;

        // Clean parentId
        let pId = raw.parentId;
        if (pId === "null" || pId === null || pId === undefined) pId = null;
        else pId = String(pId);

        if (pId && nodeMap.has(pId)) {
            const parent = nodeMap.get(pId);
            parent!.children = parent!.children || [];
            parent!.children.push(node);
        } else {
            // Top-level Section -> Add to synthetic root
            syntheticRoot.children!.push(node);
        }
    });

    // Fallback: If root has no children but we have nodes, attach them
    if (syntheticRoot.children!.length === 0 && nodeMap.size > 0) {
        console.warn("No linked top-level nodes found, attaching all orphans to root");
        nodeMap.forEach(node => syntheticRoot.children!.push(node));
    }

    return { root: syntheticRoot, markdownSummary: "", researchReport: "" };
}