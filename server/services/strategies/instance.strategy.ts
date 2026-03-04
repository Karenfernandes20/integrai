
export interface InstanceStrategy {
    createInstance(instanceId: string, company_id: number, io: any, apiKey?: string): Promise<any>;
    connectInstance(instanceId: string, companyId: number, io: any, apiKey?: string): Promise<any>;
    disconnectInstance(instanceId: string): Promise<any>;
    deleteInstance(instanceId: string): Promise<any>;
    getQRCode(instanceId: string): Promise<any>;
    getStatus(instanceId: string): Promise<string>;
}
