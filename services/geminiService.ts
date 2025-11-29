import { GoogleGenAI, Type } from "@google/genai";
import { MindMapData, MindMapNode } from '../types';

export const generateMindMap = async (text: string): Promise<MindMapData> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is missing. Please ensure it is set in your environment.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are an expert academic researcher. 
    Your task is to analyze the provided text from a research paper or document.
    
    1. Generate a comprehensive "Executive Summary" in Markdown format (Chinese).
    2. Create a hierarchical mind map of the core concepts.
    3. Generate a "Research Extension Report" (Chinese). This should list 3-5 concrete future research directions, potential experiments, or areas for improvement based on the paper's limitations or results.
    
    IMPORTANT LANGUAGE REQUIREMENT:
    - The 'label' and 'summary' fields MUST be in Simplified Chinese (简体中文).
    - Translate technical terms accurately to Chinese.
    - The 'quote' MUST be the EXACT verbatim English text from the document.
    
    Output a JSON object with:
    - markdownSummary: A detailed summary of the paper in Chinese (Markdown supported).
    - researchReport: A report on future research directions in Chinese (Markdown supported).
    - nodes: A flat list of all nodes in the map.
    
    Each node object must have:
    - id: unique string
    - parentId: string (the id of the parent node) OR null (if it is the root node)
    - label: short title in Chinese (max 10 words)
    - summary: 1 sentence explanation in Chinese
    - quote: A verbatim short string (approx 20-50 words) from the original text that best defines this concept. This allows the user to find the location in the PDF.
    - pageNumber: integer (the page number where this concept is most prominently discussed based on "--- PAGE X ---" markers)

    Rules:
    1. There must be exactly ONE root node (parentId: null).
    2. All other nodes must have a valid parentId that exists in the list.
    3. The structure should be balanced (max depth 3-4).
    4. Ensure the content covers the main contributions, methodology, and results of the paper.
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
                  parentId: { type: Type.STRING, nullable: true },
                  label: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  quote: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER }
                },
                required: ['id', 'label', 'summary', 'pageNumber']
              }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text from AI");
    }

    const data = JSON.parse(response.text);
    if (!data.nodes || !Array.isArray(data.nodes)) {
       throw new Error("Invalid response structure: 'nodes' array missing");
    }
    
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
    let root: MindMapNode | null = null;

    // 1. Create all node instances
    flatNodes.forEach(raw => {
        nodeMap.set(raw.id, {
            id: raw.id,
            label: raw.label || "Untitled",
            summary: raw.summary || "",
            quote: raw.quote || "",
            pageNumber: typeof raw.pageNumber === 'number' ? raw.pageNumber : 1,
            children: []
        });
    });

    // 2. Link children to parents
    flatNodes.forEach(raw => {
        const node = nodeMap.get(raw.id);
        if (!node) return;

        const pId = (raw.parentId === "null" || raw.parentId === "") ? null : raw.parentId;

        if (pId) {
            const parent = nodeMap.get(pId);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(node);
            }
        } else {
            // Found a root candidate
            if (!root) root = node;
        }
    });

    // Fallback if no root is explicitly defined
    if (!root) {
        if (nodeMap.size > 0) {
             root = nodeMap.values().next().value;
             console.warn("No explicit root found, using first node.");
        } else {
             throw new Error("The mind map returned by AI was empty.");
        }
    }

    return { root: root!, markdownSummary: "", researchReport: "" };
}