export type Document = {
    id: string;
    source: string;
    timestamp: string;
    content: string;
    metadata: Record<string, any>;
};
