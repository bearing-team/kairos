import { XMLParser } from "fast-xml-parser";

// preserveOrder 트리: [{ "hp:p": [...children], ":@": {attrs} }, { "#text": "..." }]
export type XNode = Record<string, unknown>;
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "", trimValues: false, processEntities: true, htmlEntities: true });

export const parseXml = (xml: string) => parser.parse(xml) as XNode[];
export const tagOf = (n: XNode) => Object.keys(n).find((k) => k !== ":@") ?? "";
export const kids = (n: XNode) => (n[tagOf(n)] as XNode[] | undefined) ?? [];
export const attrs = (n: XNode) => (n[":@"] as Record<string, string> | undefined) ?? {};
