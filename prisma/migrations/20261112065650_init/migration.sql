-- CreateTable
CREATE TABLE "profile" (
    "id" UUID NOT NULL,
    "singleton_key" VARCHAR(32) NOT NULL DEFAULT 'canonical',
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_links" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,

    CONSTRAINT "professional_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "profile_id" UUID NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" UUID NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "position" VARCHAR(200) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "profile_id" UUID NOT NULL,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "experience_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "repository_url" VARCHAR(2048),
    "sort_order" INTEGER NOT NULL,
    "profile_id" UUID NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- One canonical card. A different key cannot create a second profile.
ALTER TABLE "profile" ADD CONSTRAINT "profile_singleton_key_canonical" CHECK ("singleton_key" = 'canonical');

-- A finished role cannot end before it started.
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_end_date_on_or_after_start" CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "profile_singleton_key_key" ON "profile"("singleton_key");

-- CreateIndex
CREATE UNIQUE INDEX "professional_links_profile_id_label_key" ON "professional_links"("profile_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "professional_links_profile_id_url_key" ON "professional_links"("profile_id", "url");

-- CreateIndex
CREATE UNIQUE INDEX "skills_profile_id_name_key" ON "skills"("profile_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_profile_id_sort_order_key" ON "skills"("profile_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "experiences_profile_id_sort_order_key" ON "experiences"("profile_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "experiences_profile_id_company_position_start_date_key" ON "experiences"("profile_id", "company", "position", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_experience_id_sort_order_key" ON "achievements"("experience_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "projects_profile_id_name_key" ON "projects"("profile_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_profile_id_sort_order_key" ON "projects"("profile_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "projects_profile_id_url_key" ON "projects"("profile_id", "url");

-- AddForeignKey
ALTER TABLE "professional_links" ADD CONSTRAINT "professional_links_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
