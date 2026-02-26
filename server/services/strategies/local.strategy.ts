
import { InstanceStrategy } from './instance.strategy.js';
import { LocalInstanceService } from '../localInstance.service.js';

export class LocalStrategy implements InstanceStrategy {
    async createInstance(instanceId: string, companyId: number, io: any) {
        return LocalInstanceService.createLocalInstance(instanceId, companyId, io);
    }

    async connectInstance(instanceId: string, companyId: number, io: any) {
        return LocalInstanceService.connectInstance(instanceId, companyId, io);
    }

    async disconnectInstance(instanceId: string) {
        return LocalInstanceService.disconnectInstance(instanceId);
    }

    async deleteInstance(instanceId: string) {
        return LocalInstanceService.deleteInstance(instanceId);
    }

    async getQRCode(instanceId: string) {
        return LocalInstanceService.generateQRCode(instanceId);
    }

    async getStatus(instanceId: string) {
        return LocalInstanceService.getInstanceStatus(instanceId);
    }
}
