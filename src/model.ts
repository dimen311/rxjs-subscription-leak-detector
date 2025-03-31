export interface SubscriptionInfo {
    file: string;
    fileName: string;
    line: number;
    column: number;
    componentName: string;
    variableName?: string;
    hasUnsubscribe: boolean;
}