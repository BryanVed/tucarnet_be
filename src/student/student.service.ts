import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { UpdateStudentDto } from './dto/update-student.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateBiometricDto } from './dto/update-biometric.dto';
import { BiometricStatus, ValidationResult, Prisma } from '@prisma/client';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener estudiante por email
   * @param email El email del estudiante.
   * @returns La información del estudiante asociado al email.
   */
  async getStudentByEmail(email: string) {
    try {
      const student = await this.prisma.student.findFirst({
        where: { email },
        include: {
          biometric_profile: true,
          photo_requests: true,
        },
      });

      if (!student) {
        throw new NotFoundException('Estudiante no encontrado');
      }

      return student;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtener estudiante por código de estudiante
   * @param student_code El código del estudiante.
   * @returns La información del estudiante asociado al código.
   */
  async getStudentByCode(student_code: string) {
    try {
      const student = await this.prisma.student.findFirst({
        where: { student_code },
        include: {
          biometric_profile: true,
          photo_requests: true,
        },
      });

      if (!student) {
        throw new NotFoundException('Estudiante no encontrado');
      }

      return student;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Actualizar información del estudiante
   * @param id El ID del estudiante.
   * @param updateStudentDto Objeto con los datos a actualizar.
   * @returns Mensaje de confirmación.
   */
  update(id: number, updateStudentDto: UpdateStudentDto) {
    return `This action updates a #${id} student`;
  }

  /**
   * Actualiza el perfil biométrico del estudiante después de validación con Rekognition
   * @param updateBiometricDto Datos de la validación biométrica
   * @returns Estudiante actualizado con su perfil biométrico
   */
  async updateBiometricProfile(updateBiometricDto: UpdateBiometricDto) {
    try {
      const { student_id, card_photo_key, similarity } = updateBiometricDto;

      // 1. Verificar que el estudiante existe
      const student = await this.prisma.student.findUnique({
        where: { student_id },
        include: { biometric_profile: true },
      });

      if (!student) {
        throw new NotFoundException(
          `Estudiante con ID ${student_id} no encontrado`,
        );
      }

      // 2. Verificar que existe el perfil biométrico
      if (!student.biometric_profile) {
        throw new BadRequestException(
          'El estudiante no tiene un perfil biométrico creado',
        );
      }

      // 3. Validar que no esté ya aprobado
      if (student.biometric_profile.status === BiometricStatus.APROBADO) {
        throw new BadRequestException(
          'El perfil biométrico ya está aprobado y no puede ser modificado',
        );
      }

      // 4. Determinar resultado basado en similaridad
      // Ajusta estos umbrales según tus necesidades
      const SIMILARITY_THRESHOLD = 90; // 90% de similaridad mínima
      const result =
        similarity >= SIMILARITY_THRESHOLD
          ? ValidationResult.APROBADO
          : ValidationResult.RECHAZADO;

      const newBiometricStatus =
        similarity >= SIMILARITY_THRESHOLD
          ? BiometricStatus.APROBADO
          : BiometricStatus.RECHAZADO;

      // 5. Actualizar en una transacción
      const updatedStudent = await this.prisma.$transaction(async (prisma) => {
        // 5.1 Registrar log de validación
        await prisma.biometricValidationLog.create({
          data: {
            biometric_id: student_id,
            similitarity: similarity,
            result: result,
          },
        });

        // 5.2 Actualizar estado del perfil biométrico
        await prisma.biometricProfile.update({
          where: { student_id },
          data: {
            status: newBiometricStatus,
          },
        });

        // 5.3 Si fue APROBADO, actualizar la foto del estudiante
        if (result === ValidationResult.APROBADO) {
          await prisma.student.update({
            where: { student_id },
            data: {
              card_photo_key,
              updated_at: new Date(),
            },
          });
        }

        // 5.4 Retornar estudiante actualizado
        return await prisma.student.findUnique({
          where: { student_id },
          include: {
            biometric_profile: {
              include: {
                validations: {
                  orderBy: { created_at: 'desc' },
                  take: 3, // Últimas 3 validaciones
                },
              },
            },
          },
        });
      });

      return {
        success: result === ValidationResult.APROBADO,
        message:
          result === ValidationResult.APROBADO
            ? 'Validación biométrica aprobada exitosamente'
            : `Validación rechazada. Similaridad: ${similarity}%. Se requiere al menos ${SIMILARITY_THRESHOLD}%`,
        student: updatedStudent,
        validation: {
          similarity,
          result,
          threshold: SIMILARITY_THRESHOLD,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error('Error al actualizar perfil biométrico', error);
      throw new InternalServerErrorException(
        'Error al procesar la validación biométrica',
      );
    }
  }

  /**
   * Obtiene el estado biométrico actual del estudiante
   * @param student_id ID del estudiante
   * @returns Perfil biométrico con historial de validaciones
   */
  async getBiometricStatus(student_id: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { student_id },
        select: {
          student_id: true,
          name: true,
          last_name: true,
          email: true,
          card_photo_key: true,
          biometric_profile: {
            include: {
              validations: {
                orderBy: { created_at: 'desc' },
              },
            },
          },
        },
      });

      if (!student) {
        throw new NotFoundException(
          `Estudiante con ID ${student_id} no encontrado`,
        );
      }

      if (!student.biometric_profile) {
        throw new NotFoundException(
          'El estudiante no tiene un perfil biométrico',
        );
      }

      const totalAttempts = student.biometric_profile.validations.length;
      const lastValidation = student.biometric_profile.validations[0];
      const isApproved =
        student.biometric_profile.status === BiometricStatus.APROBADO;

      return {
        student_id: student.student_id,
        name: `${student.name} ${student.last_name}`,
        email: student.email,
        photo_url: student.card_photo_key,
        biometric_status: student.biometric_profile.status,
        total_attempts: totalAttempts,
        last_validation: lastValidation
          ? {
              similarity: lastValidation.similitarity.toNumber(),
              result: lastValidation.result,
              date: lastValidation.created_at,
            }
          : null,
        can_retry: !isApproved,
        validations_history: student.biometric_profile.validations.map((v) => ({
          validation_id: v.validation_id,
          similarity: v.similitarity.toNumber(),
          result: v.result,
          date: v.created_at,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error('Error al obtener estado biométrico', error);
      throw new InternalServerErrorException(
        'Error al consultar el estado biométrico',
      );
    }
  }

  /**
   * Reinicia el perfil biométrico (solo para casos especiales o admin)
   * @param student_id ID del estudiante
   * @returns Perfil biométrico reiniciado
   */
  async resetBiometricProfile(student_id: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { student_id },
        include: { biometric_profile: true },
      });

      if (!student) {
        throw new NotFoundException(
          `Estudiante con ID ${student_id} no encontrado`,
        );
      }

      if (!student.biometric_profile) {
        throw new NotFoundException(
          'El estudiante no tiene un perfil biométrico',
        );
      }

      // Actualizar estado a PENDIENTE
      const updatedProfile = await this.prisma.biometricProfile.update({
        where: { student_id },
        data: {
          status: BiometricStatus.PENDIENTE,
        },
        include: {
          validations: {
            orderBy: { created_at: 'desc' },
          },
        },
      });

      return {
        success: true,
        message: 'Perfil biométrico reiniciado exitosamente',
        profile: updatedProfile,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error al reiniciar perfil biométrico', error);
      throw new InternalServerErrorException(
        'Error al reiniciar el perfil biométrico',
      );
    }
  }

  /**
   * Lista estudiantes con búsqueda opcional por código, email o nombre y paginación.
   * @param params search (término de búsqueda), page y limit
   * @returns { data, total, page, limit }
   */
  async findAllStudents(params: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = search
      ? {
          OR: [
            { student_code: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: { biometric_profile: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
