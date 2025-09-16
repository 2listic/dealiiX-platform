FROM dealii/dealii:v9.5.1-jammy

USER root
RUN apt update -y && \
    apt install -y \
    sudo munge slurmd slurm-client slurmctld mariadb-server \
    vim less \
    python3 python3-pip python3-venv \
    openssh-server && \
    apt clean && rm -rf /var/lib/apt/lists/*
# RUN mkdir /var/run/sshd
RUN mkdir -p /run/sshd

# User configuration
# ADD sudoers /etc/sudoers

RUN mkdir -p /root/.ssh && \
  chmod 700 /root/.ssh

RUN --mount=type=secret,id=ssh-key \
  cp /run/secrets/ssh-key /root/.ssh/authorized_keys && \
  chmod 600 /root/.ssh/authorized_keys

RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config

# # Create Slurm directories
# RUN mkdir -p /var/log/slurm /var/spool/slurmd.slurmnode1 /var/spool/slurmctld /var/run && \
#   chmod 755 /var/log/slurm /var/spool/slurmd.slurmnode1 /var/spool/slurmctld

COPY slurm.conf /etc/slurm/
COPY cgroup.conf /etc/slurm/

COPY docker-entrypoint.sh /etc/slurm/
RUN chmod +x /etc/slurm/docker-entrypoint.sh
EXPOSE 22 6817 6818 8000

WORKDIR /

ENTRYPOINT ["/etc/slurm/docker-entrypoint.sh"]
