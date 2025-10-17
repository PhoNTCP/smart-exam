-- AlterTable
ALTER TABLE `examattempt` ADD COLUMN `currentQuestionId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `ExamAttempt` ADD CONSTRAINT `ExamAttempt_currentQuestionId_fkey` FOREIGN KEY (`currentQuestionId`) REFERENCES `Question`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
