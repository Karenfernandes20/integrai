
export interface InstanceStrategy {
    createInstance(instanceId: string, companyId: number, io: any): Promise<any>;
    connectInstance(instanceId: string, companyId: number, io: any): Promise<any>;
    disconnectInstance(instanceId: string): Promise<any>;
    deleteInstance(instanceId: string): Promise<any>;
    getQRCode(instanceId: string): Promise<string | null>;
    getStatus(instanceId: string): Promise<string>;
}
