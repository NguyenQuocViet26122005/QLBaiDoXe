import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { AppError,forbidden,notFound } from '../utils/app-error.js';
import { code,normalizePlate } from '../utils/security.js';
import { auditService } from './audit.service.js';
import { openSessionWhere, occupiedVehicles, lockArea, lockVehicle, peakOccupancy, reservationIntervals, transactionOptions } from './business-rules.js';

const scopeResident=(auth:any,id:number)=>{if(auth.role==='RESIDENT'&&auth.residentId===id)return;if(['MANAGER','ADMIN'].includes(auth.role))return;throw forbidden();};
const assertPriceWindow=async(input:any,excludeId?:number,client:any=prisma)=>{const from=new Date(input.effectiveFrom),to=input.effectiveTo?new Date(input.effectiveTo):null;if(to&&to<=from)throw new AppError(422,'INVALID_PRICE_PERIOD','Ngày kết thúc giá phải sau ngày bắt đầu');if(input.status==='INACTIVE')return;const overlap=await client.priceConfig.findFirst({where:{id:excludeId?{not:excludeId}:undefined,planId:input.planId,areaId:input.areaId??null,status:'ACTIVE',effectiveFrom:{lt:to??new Date('9999-12-31')},OR:[{effectiveTo:null},{effectiveTo:{gt:from}}]}});if(overlap)throw new AppError(409,'PRICE_PERIOD_OVERLAP','Khoảng hiệu lực của bảng giá bị chồng lấn');};
export const managementService={
  async listResidents(auth:any){return prisma.resident.findMany({where:auth.role==='RESIDENT'?{id:auth.residentId}:{},include:{user:{select:{id:true,email:true,fullName:true,phone:true,role:true,status:true}},apartment:true},orderBy:{id:'desc'}});},
  async getResident(auth:any,id:number){scopeResident(auth,id);const data=await prisma.resident.findUnique({where:{id},include:{user:{select:{id:true,email:true,fullName:true,phone:true,role:true,status:true}},apartment:true,vehicles:true}});if(!data)throw notFound('Cư dân');return data;},
  async createResident(input:any){if(await prisma.user.findUnique({where:{email:input.email.toLowerCase()}}))throw new AppError(409,'EMAIL_EXISTS','Email đã tồn tại');if(input.phone&&await prisma.user.findUnique({where:{phone:input.phone}}))throw new AppError(409,'PHONE_EXISTS','Số điện thoại đã tồn tại');return prisma.user.create({data:{email:input.email.toLowerCase(),passwordHash:await bcrypt.hash(input.password,12),fullName:input.fullName,phone:input.phone,role:'RESIDENT',resident:{create:{residentCode:code('CD'),apartmentId:input.apartmentId,identityNumber:input.identityNumber,address:input.address}}},select:{id:true,email:true,fullName:true,phone:true,role:true,status:true,createdAt:true,resident:true}});},
  async updateResident(auth:any,id:number,input:any){
    scopeResident(auth,id);
    const resident=await prisma.resident.findUnique({where:{id}});
    if(!resident)throw notFound('Cư dân');
    if(auth.role==='RESIDENT'&&(input.status!==undefined||input.apartmentId!==undefined))throw new AppError(403,'RESIDENT_ADMIN_FIELDS','Chỉ quản lý được thay đổi căn hộ hoặc trạng thái cư dân');
    if(input.apartmentId){const apartment=await prisma.apartment.findUnique({where:{id:input.apartmentId}});if(!apartment||apartment.status!=='ACTIVE')throw new AppError(409,'APARTMENT_INACTIVE','Căn hộ không hoạt động');}
    const {fullName,phone,...residentData}=input;
    return prisma.resident.update({where:{id},data:{...residentData,user:{update:{...(fullName!==undefined&&{fullName}),...(phone!==undefined&&{phone})}}},include:{user:{select:{id:true,email:true,fullName:true,phone:true,status:true}},apartment:true}});
  },
  async deleteResident(id:number){const r=await prisma.resident.findUnique({where:{id},include:{vehicles:true}});if(!r)throw notFound('Cư dân');if(r.vehicles.length)throw new AppError(409,'RESIDENT_HAS_VEHICLES','Không thể xóa cư dân đang có xe');return prisma.user.delete({where:{id:r.userId},select:{id:true,email:true,fullName:true}});},
  listApartments:()=>prisma.apartment.findMany({include:{_count:{select:{residents:true}}},orderBy:[{building:'asc'},{apartmentNumber:'asc'}]}),
  getApartment:(id:number)=>prisma.apartment.findUniqueOrThrow({where:{id},include:{residents:true}}),
  createApartment:(x:any)=>prisma.apartment.create({data:x}),updateApartment:(id:number,x:any)=>prisma.apartment.update({where:{id},data:x}),async deleteApartment(id:number){const apartment=await prisma.apartment.findUnique({where:{id},include:{_count:{select:{residents:true}}}});if(!apartment)throw notFound('Căn hộ');if(apartment._count.residents)throw new AppError(409,'APARTMENT_HAS_RESIDENTS','Không thể xóa căn hộ đang có cư dân');return prisma.apartment.delete({where:{id}});},
  async listVehicles(auth:any){return prisma.vehicle.findMany({where:auth.role==='RESIDENT'?{residentId:auth.residentId}:{},include:{resident:{include:{user:{select:{fullName:true}}}},tickets:{where:{status:{in:['ACTIVE','LOCKED']}},take:1}},orderBy:{id:'desc'}});},
  async getVehicle(auth:any,id:number){const v=await prisma.vehicle.findUnique({where:{id},include:{resident:true,tickets:true,sessions:true,violations:true}});if(!v)throw notFound('Xe');scopeResident(auth,v.residentId);return v;},
  async createVehicle(auth:any,input:any){const residentId=auth.role==='RESIDENT'?auth.residentId:input.residentId;if(!residentId)throw new AppError(422,'RESIDENT_REQUIRED','Thiếu cư dân sở hữu xe');const resident=await prisma.resident.findUnique({where:{id:residentId},include:{user:true}});if(!resident||resident.status!=='ACTIVE'||resident.user.status!=='ACTIVE')throw new AppError(409,'RESIDENT_INACTIVE','Cư dân không hoạt động');const normalizedPlate=normalizePlate(input.licensePlate);if(normalizedPlate.replace(/[^A-Z0-9]/g,'').length<4)throw new AppError(422,'INVALID_LICENSE_PLATE','Biển số hoặc mã nhận dạng không hợp lệ');return prisma.vehicle.create({data:{...input,residentId,licensePlate:normalizedPlate,normalizedPlate}});},
  async updateVehicle(auth:any,id:number,input:any){
    return prisma.$transaction(async tx=>{
      await lockVehicle(tx,id);
      const v=await tx.vehicle.findUnique({where:{id},include:{_count:{select:{registrations:true,tickets:true,sessions:true,violations:true}}}});
      if(!v)throw notFound('Xe');scopeResident(auth,v.residentId);
      const {residentId:_residentId,...data}=input;
      void _residentId;
      const identityChanged=(data.licensePlate!==undefined&&normalizePlate(data.licensePlate)!==normalizePlate(v.licensePlate))||(data.type!==undefined&&data.type!==v.type);
      if(identityChanged&&Object.values(v._count).some(n=>n>0))throw new AppError(409,'VEHICLE_HAS_HISTORY','Xe có lịch sử: hãy tạo phương tiện mới khi đổi biển số hoặc loại xe');
      if(data.status==='INACTIVE'){
        const now=new Date();
        const [ticket,registration,session]=await Promise.all([
          tx.parkingTicket.findFirst({where:{vehicleId:id,status:{in:['ACTIVE','LOCKED','PENDING']},endDate:{gt:now}}}),
          tx.parkingRegistration.findFirst({where:{vehicleId:id,status:{in:['PENDING','APPROVED']},expiresAt:{gt:now},ticket:{is:null}}}),
          tx.parkingSession.findFirst({where:{vehicleId:id,...openSessionWhere}}),
        ]);
        if(ticket||registration||session)throw new AppError(409,'VEHICLE_HAS_ACTIVE_BUSINESS','Xe đang có đăng ký, vé hoặc lượt gửi mở');
      }
      if(data.licensePlate!==undefined){data.normalizedPlate=normalizePlate(data.licensePlate);data.licensePlate=data.normalizedPlate;if(data.normalizedPlate.replace(/[^A-Z0-9]/g,'').length<4)throw new AppError(422,'INVALID_LICENSE_PLATE','Biển số hoặc mã nhận dạng không hợp lệ');}
      return tx.vehicle.update({where:{id},data});
    },transactionOptions);
  },
  async deleteVehicle(auth:any,id:number){const v=await prisma.vehicle.findUnique({where:{id},include:{tickets:true,registrations:true}});if(!v)throw notFound('Xe');scopeResident(auth,v.residentId);if(v.tickets.length||v.registrations.length)throw new AppError(409,'VEHICLE_HAS_HISTORY','Không thể xóa xe đã có lịch sử');return prisma.vehicle.delete({where:{id}});},
  listPlans:()=>prisma.parkingPlan.findMany({orderBy:{id:'desc'}}),
  createPlan:(x:any)=>prisma.parkingPlan.create({data:x}),
  async updatePlan(id:number,x:any){return prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT `id` FROM `ParkingPlan` WHERE `id` = ? FOR UPDATE',id);
    const current=await tx.parkingPlan.findUnique({where:{id}});if(!current)throw notFound('Gói gửi');
    if((x.durationMonths!==undefined&&x.durationMonths!==current.durationMonths)||(x.vehicleType!==undefined&&x.vehicleType!==current.vehicleType)){
      if(await tx.parkingRegistration.count({where:{planId:id}}))throw new AppError(409,'PLAN_HAS_HISTORY','Không đổi thời hạn hoặc loại xe của gói đã có hồ sơ; hãy tạo gói mới');
    }
    return tx.parkingPlan.update({where:{id},data:x});
  },transactionOptions);},
  deletePlan:(id:number)=>prisma.parkingPlan.delete({where:{id}}),
  getPlan:(id:number)=>prisma.parkingPlan.findUniqueOrThrow({where:{id},include:{priceConfigs:true}}),
  listAreas:()=>prisma.parkingArea.findMany({orderBy:{id:'desc'}}),
  createArea:(x:any)=>prisma.parkingArea.create({data:x}),
  async updateArea(id:number,x:any){return prisma.$transaction(async tx=>{
    await lockArea(tx,id);
    if(x.capacity!==undefined){
      const occupied=await occupiedVehicles(tx,id);
      if(x.capacity<occupied)throw new AppError(409,'CAPACITY_BELOW_OCCUPIED','Sức chứa không được nhỏ hơn số xe đang gửi');
      const now=new Date(),intervals=await reservationIntervals(tx,id,now);
      if(x.capacity<peakOccupancy(intervals,now,new Date('9999-12-31')))throw new AppError(409,'CAPACITY_BELOW_RESERVED','Sức chứa không được nhỏ hơn số chỗ đã duyệt hoặc bán vé');
    }
    return tx.parkingArea.update({where:{id},data:x});
  },transactionOptions);},
  deleteArea:(id:number)=>prisma.parkingArea.delete({where:{id}}),
  getArea:(id:number)=>prisma.parkingArea.findUniqueOrThrow({where:{id}}),
  listPrices:()=>prisma.priceConfig.findMany({include:{plan:true,area:true},orderBy:{effectiveFrom:'desc'}}),
  getPrice:(id:number)=>prisma.priceConfig.findUniqueOrThrow({where:{id},include:{plan:true,area:true}}),
  async createPrice(auth:any,x:any){return prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT `id` FROM `ParkingPlan` WHERE `id` = ? FOR UPDATE',x.planId);
    await assertPriceWindow(x,undefined,tx);
    const row=await tx.priceConfig.create({data:x});
    await auditService.record(auth,{action:'PRICE_CREATE',entity:'PriceConfig',entityId:row.id,metadata:{amount:String(row.amount)}},tx);
    return row;
  },transactionOptions);},
  async updatePrice(auth:any,id:number,x:any){return prisma.$transaction(async tx=>{
    const initial=await tx.priceConfig.findUnique({where:{id}});if(!initial)throw notFound('Bảng giá');
    for(const planId of [...new Set([initial.planId,x.planId??initial.planId])].sort((a,b)=>a-b))await tx.$queryRawUnsafe('SELECT `id` FROM `ParkingPlan` WHERE `id` = ? FOR UPDATE',planId);
    const current=await tx.priceConfig.findUniqueOrThrow({where:{id}});
    if(x.planId!==undefined&&x.planId!==current.planId)throw new AppError(409,'PRICE_SCOPE_IMMUTABLE','Hãy tạo bảng giá mới khi thay đổi gói');
    const used=await tx.parkingRegistration.count({where:{priceConfigId:id}});
    if(used&&((x.amount!==undefined&&Number(x.amount)!==Number(current.amount))||(x.areaId!==undefined&&x.areaId!==current.areaId)||(x.effectiveFrom!==undefined&&new Date(x.effectiveFrom).getTime()!==current.effectiveFrom.getTime())))throw new AppError(409,'PRICE_IN_USE','Không sửa số tiền, phạm vi hoặc ngày bắt đầu của giá đã dùng; hãy tạo mức giá mới');
    await assertPriceWindow({...current,...x},id,tx);
    const row=await tx.priceConfig.update({where:{id},data:x});
    await auditService.record(auth,{action:'PRICE_UPDATE',entity:'PriceConfig',entityId:id,metadata:{amount:String(row.amount)}},tx);return row;
  },transactionOptions);},
  async deletePrice(auth:any,id:number){const row=await prisma.priceConfig.findUnique({where:{id},include:{_count:{select:{registrations:true,tickets:true}}}});if(!row)throw notFound('Bảng giá');if(row._count.registrations||row._count.tickets)throw new AppError(409,'PRICE_IN_USE','Không thể xóa bảng giá đã được sử dụng');const deleted=await prisma.priceConfig.delete({where:{id}});await auditService.bestEffort(auth,{action:'PRICE_DELETE',entity:'PriceConfig',entityId:id});return deleted;},
  listUsers:()=>prisma.user.findMany({select:{id:true,email:true,fullName:true,phone:true,role:true,status:true,createdAt:true},orderBy:{id:'desc'}}),
  async updateUser(actor:any,id:number,x:any){return prisma.$transaction(async tx=>{
    // Serialize account-role changes, including competing demotions of the last admins.
    await tx.$queryRawUnsafe('SELECT `id` FROM `User` ORDER BY `id` FOR UPDATE');
    const before=await tx.user.findUnique({where:{id},include:{resident:true}});if(!before)throw notFound('Tài khoản');
    if(x.role==='RESIDENT'&&!before.resident)throw new AppError(409,'RESIDENT_PROFILE_REQUIRED','Tài khoản chưa có hồ sơ cư dân; hãy tạo hồ sơ cư dân riêng');
    if(before.role==='RESIDENT'&&x.role&&x.role!=='RESIDENT')throw new AppError(409,'RESIDENT_ROLE_IMMUTABLE','Dùng tài khoản nhân viên riêng để giữ quyền sở hữu và lịch sử cư dân');
    if(before.role==='ADMIN'&&before.status==='ACTIVE'&&((x.role&&x.role!=='ADMIN')||(x.status&&x.status!=='ACTIVE'))&&await tx.user.count({where:{role:'ADMIN',status:'ACTIVE'}})<=1)throw new AppError(409,'LAST_ACTIVE_ADMIN','Phải duy trì ít nhất một quản trị viên hoạt động');
    const updated=await tx.user.update({where:{id},data:x,select:{id:true,email:true,fullName:true,phone:true,role:true,status:true}});
    if((x.role&&x.role!==before.role)||(x.status&&x.status!==before.status))await tx.refreshToken.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});
    await auditService.record(actor,{action:'ACCOUNT_UPDATE',entity:'User',entityId:id,metadata:{before:{role:before.role,status:before.status},after:x}},tx);
    return updated;
  },transactionOptions);}

};
