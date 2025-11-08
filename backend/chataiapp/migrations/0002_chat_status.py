from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chataiapp", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="chat",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("ended", "Ended")],
                default="active",
                max_length=10,
            ),
        ),
    ]

